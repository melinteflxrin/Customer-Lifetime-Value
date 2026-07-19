"""Phase 2 — propensity models for the three products.

For each product we train a calibrated classifier that outputs P(buy),
evaluate it honestly on a held-out test set (AUC, top-decile lift/capture,
calibration), then score every customer for the dashboard.

Design notes:
- `duration` is EXCLUDED everywhere (leakage — only known after contact).
- When predicting a product, that product's own column is dropped from the
  features; the other two products stay in as behavioural signal.
- Scores for the dashboard are out-of-fold (cross_val_predict) so no customer
  is scored by a model that trained on them.
"""
import json
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_predict, StratifiedKFold
from sklearn.metrics import roc_auc_score, brier_score_loss

RAW = "bank_marketing_raw/bank-full.csv"
LEAK = "duration"          # excluded — post-contact leakage
PRODUCTS = ["y", "housing", "loan"]
PRODUCT_LABEL = {"y": "term_deposit", "housing": "housing_loan", "loan": "personal_loan"}
RANDOM_STATE = 42

df = pd.read_csv(RAW, sep=";")
df.insert(0, "customer_id", [f"C{100000 + i}" for i in range(len(df))])

# binary 0/1 versions of the product columns
for p in PRODUCTS:
    df[f"_bin_{p}"] = (df[p] == "yes").astype(int)


def build_estimator(cat_cols, num_cols):
    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
        ("num", "passthrough", num_cols),
    ])
    base = Pipeline([
        ("pre", pre),
        ("gbm", HistGradientBoostingClassifier(random_state=RANDOM_STATE)),
    ])
    # calibrated probabilities (isotonic, internal 3-fold)
    return CalibratedClassifierCV(base, method="isotonic", cv=3)


def decile_gains(y_true, scores):
    """Cumulative gains + lift per decile (10 = highest-scored 10%)."""
    order = np.argsort(-scores)
    y_sorted = np.asarray(y_true)[order]
    n = len(y_sorted)
    total_pos = y_sorted.sum()
    base_rate = total_pos / n
    rows = []
    for d in range(1, 11):
        k = int(round(n * d / 10))
        captured = y_sorted[:k].sum()
        rows.append({
            "decile": d,
            "pct_customers": d * 10,
            "cum_capture_pct": round(100 * captured / total_pos, 1),
            "decile_response_rate": None,  # filled below
        })
    # per-decile (non-cumulative) response rate for lift
    for d in range(1, 11):
        lo, hi = int(round(n * (d - 1) / 10)), int(round(n * d / 10))
        rr = y_sorted[lo:hi].mean()
        rows[d - 1]["decile_response_rate"] = round(100 * rr, 1)
        rows[d - 1]["lift"] = round(rr / base_rate, 2)
    return rows, base_rate


metrics = {}
lift_rows = []
score_frame = df[["customer_id"]].copy()

for target in PRODUCTS:
    label = PRODUCT_LABEL[target]
    y = df[f"_bin_{target}"].values

    # features: drop ids, the raw product strings, all _bin_ helpers, and leakage
    drop = ["customer_id", LEAK] + PRODUCTS + [f"_bin_{p}" for p in PRODUCTS]
    # keep the OTHER two products (0/1) as features
    feats = df.drop(columns=drop).copy()
    for other in PRODUCTS:
        if other != target:
            feats[PRODUCT_LABEL[other]] = df[f"_bin_{other}"]

    cat_cols = feats.select_dtypes("object").columns.tolist()
    num_cols = feats.select_dtypes(exclude="object").columns.tolist()

    # --- honest held-out evaluation ---
    X_tr, X_te, y_tr, y_te = train_test_split(
        feats, y, test_size=0.25, stratify=y, random_state=RANDOM_STATE)
    est = build_estimator(cat_cols, num_cols)
    est.fit(X_tr, y_tr)
    p_te = est.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, p_te)
    brier = brier_score_loss(y_te, p_te)
    gains, base_rate = decile_gains(y_te, p_te)
    top_decile = gains[0]
    metrics[label] = {
        "target_col": target,
        "base_rate_pct": round(100 * base_rate, 1),
        "auc": round(auc, 3),
        "brier": round(brier, 4),
        "top_decile_lift": top_decile["lift"],
        "top_decile_capture_pct": top_decile["cum_capture_pct"],
    }
    for g in gains:
        lift_rows.append({"product": label, **g})

    # --- out-of-fold scores for every customer (dashboard) ---
    # NOTE: data is ordered chronologically by campaign, so folds MUST be
    # shuffled + stratified, else contiguous time-blocks invert the scores.
    oof_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    oof = cross_val_predict(
        build_estimator(cat_cols, num_cols), feats, y,
        cv=oof_cv, method="predict_proba")[:, 1]
    score_frame[f"propensity_{label}"] = oof.round(4)

    print(f"{label:<14} base={metrics[label]['base_rate_pct']:>4}%  "
          f"AUC={auc:.3f}  top-decile lift={top_decile['lift']:.1f}x  "
          f"capture={top_decile['cum_capture_pct']:.0f}%")

# attach a few raw fields useful downstream (value layer / dashboard)
keep = ["customer_id", "age", "job", "marital", "education", "balance",
        "housing", "loan", "y"]
out = score_frame.merge(df[keep], on="customer_id")
out.to_csv("scored_customers.csv", index=False)
pd.DataFrame(lift_rows).to_csv("lift_data.csv", index=False)
with open("phase2_metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)

print("\nSaved: scored_customers.csv, lift_data.csv, phase2_metrics.json")

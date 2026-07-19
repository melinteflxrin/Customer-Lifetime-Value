"""Phase 5 — assemble a compact JSON payload for the dashboard + deck."""
import json
import numpy as np
import pandas as pd

nbo = pd.read_csv("nbo_recommendations.csv")
scored = pd.read_csv("scored_customers.csv")
lift = pd.read_csv("lift_data.csv")
metrics = json.load(open("phase2_metrics.json"))

total_opp = float(nbo["opportunity_value"].sum())
payload = {}

# ── KPIs ──
payload["kpis"] = {
    "customers": int(len(nbo)),
    "total_opportunity": total_opp,
    "avg_opportunity": float(nbo["opportunity_value"].mean()),
    "median_opportunity": float(nbo["opportunity_value"].median()),
    "top_decile_share": float(
        nbo.head(len(nbo) // 10)["opportunity_value"].sum() / total_opp),
}

# ── model metrics ──
payload["models"] = metrics  # term_deposit / housing_loan / personal_loan

# ── lift / cumulative-gains curve per product ──
gains = {}
for prod in lift["product"].unique():
    sub = lift[lift["product"] == prod].sort_values("decile")
    gains[prod] = {
        "pct_customers": [0] + sub["pct_customers"].tolist(),
        "cum_capture": [0.0] + sub["cum_capture_pct"].tolist(),
        "decile_response": sub["decile_response_rate"].tolist(),
        "lift": sub["lift"].tolist(),
    }
payload["gains"] = gains

# ── next-best-offer mix ──
mix = nbo["next_best_offer"].value_counts()
val_by = nbo.groupby("next_best_offer")["nbo_expected_value"].sum()
payload["nbo_mix"] = [
    {"product": p, "customers": int(mix[p]), "value": float(val_by[p])}
    for p in ["Term Deposit", "Housing Loan", "Personal Loan"]
]

# ── opportunity by age band (avg) ──
scored2 = scored.merge(nbo[["customer_id", "opportunity_value"]], on="customer_id")
bands = pd.cut(scored2["age"], [17, 30, 40, 50, 60, 120],
               labels=["18-30", "31-40", "41-50", "51-60", "60+"])
by_age = scored2.groupby(bands, observed=True)["opportunity_value"].mean()
payload["opp_by_age"] = [{"band": str(b), "avg": float(v)} for b, v in by_age.items()]

# ── opportunity by job (top by avg, min sample) ──
byjob = scored2.groupby("job")["opportunity_value"].agg(["mean", "size"])
byjob = byjob[byjob["size"] >= 300].sort_values("mean", ascending=False)
payload["opp_by_job"] = [
    {"job": j, "avg": float(r["mean"]), "n": int(r["size"])}
    for j, r in byjob.iterrows()]

# ── term-deposit uptake by segment (the 'signal is real' story) ──
scored["ytrue"] = (scored["y"] == "yes").astype(int)
seg = scored.groupby("job")["ytrue"].agg(["mean", "size"])
seg = seg[seg["size"] >= 300].sort_values("mean", ascending=False)
payload["td_uptake_by_job"] = [
    {"job": j, "rate": float(r["mean"]), "n": int(r["size"])}
    for j, r in seg.iterrows()]
payload["td_base_rate"] = float(scored["ytrue"].mean())

# ── target list: top 500 opportunity customers ──
cols = ["opportunity_rank", "customer_id", "age", "job", "balance",
        "propensity_term_deposit", "propensity_housing_loan",
        "propensity_personal_loan", "next_best_offer",
        "nbo_expected_value", "opportunity_value"]
top = nbo[cols].head(500).copy()
top["balance"] = top["balance"].astype(int)
for c in ["propensity_term_deposit", "propensity_housing_loan", "propensity_personal_loan"]:
    top[c] = top[c].round(3)
payload["target_list"] = top.to_dict(orient="records")

# ── product value assumptions (for transparency panel) ──
payload["assumptions"] = {
    "term_deposit": "€300 + 5% of balance",
    "housing_loan": "€1,500 flat",
    "personal_loan": "€800 flat",
    "discount": "no retention discount on this dataset (no churn signal)",
}

with open("dashboard_data.json", "w") as f:
    json.dump(payload, f, separators=(",", ":"))

import os
print(f"Saved dashboard_data.json ({os.path.getsize('dashboard_data.json')/1024:.0f} KB)")
print("target_list rows:", len(payload["target_list"]))
print("KPIs:", {k: round(v, 2) if isinstance(v, float) else v for k, v in payload["kpis"].items()})

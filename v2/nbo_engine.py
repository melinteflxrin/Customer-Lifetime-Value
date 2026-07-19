"""Phase 3 + 4 — Next-Best-Offer engine and customer value score.

Turns propensities into money:
    expected_value(product) = P(buy) x product_value
    next_best_offer        = eligible product with the highest expected value
    opportunity_value       = sum of expected values across eligible products

Product values are MADE UP for this demo (clearly labelled). Term-deposit
value scales with balance (net interest margin on deposited funds); the two
loans use a flat assumed lifetime margin.

Eligibility: never recommend a product the customer already holds. Housing /
personal loan are dropped if already held. A term deposit can always be
re-offered, so everyone is eligible for it.
"""
import numpy as np
import pandas as pd

# ── MADE-UP product economics (demo only — not real figures) ──
# Chosen so all three products are the same order of magnitude, so the
# next-best-offer is driven by the INTERACTION of propensity and value
# (i.e. the models), not by one product's price tag dominating everything.
def term_deposit_value(balance):
    # assumed multi-year net interest margin on funds: €300 floor + 5% of balance
    return 300 + 0.05 * np.clip(balance, 0, None)

HOUSING_LOAN_VALUE = 1500.0   # assumed lifetime margin on a mortgage (highest — realistic)
PERSONAL_LOAN_VALUE = 800.0   # assumed lifetime margin on a personal loan

PRODUCTS = ["term_deposit", "housing_loan", "personal_loan"]
NICE = {"term_deposit": "Term Deposit",
        "housing_loan": "Housing Loan",
        "personal_loan": "Personal Loan"}

df = pd.read_csv("scored_customers.csv")

# ── per-product value (customer-level) ──
val = pd.DataFrame(index=df.index)
val["term_deposit"] = term_deposit_value(df["balance"].values)
val["housing_loan"] = HOUSING_LOAN_VALUE
val["personal_loan"] = PERSONAL_LOAN_VALUE

# ── eligibility mask (can't sell what they already hold) ──
elig = pd.DataFrame(index=df.index)
elig["term_deposit"] = True                       # always re-offerable
elig["housing_loan"] = (df["housing"] == "no")
elig["personal_loan"] = (df["loan"] == "no")

# ── expected value per product = propensity x value, gated by eligibility ──
ev = pd.DataFrame(index=df.index)
for p in PRODUCTS:
    ev[p] = (df[f"propensity_{p}"] * val[p]).where(elig[p], np.nan)

out = df[["customer_id", "age", "job", "balance"]].copy()
for p in PRODUCTS:
    out[f"propensity_{p}"] = df[f"propensity_{p}"]
    out[f"value_{p}"] = val[p].round(0)
    out[f"ev_{p}"] = ev[p].round(2)

# ── next best offer = eligible product with max expected value ──
out["next_best_offer"] = ev.idxmax(axis=1).map(NICE)
out["nbo_expected_value"] = ev.max(axis=1).round(2)
# opportunity = total expected cross-sell value across eligible products
out["opportunity_value"] = ev.sum(axis=1, skipna=True).round(2)
out = out.sort_values("opportunity_value", ascending=False).reset_index(drop=True)
out["opportunity_rank"] = out.index + 1

out.to_csv("nbo_recommendations.csv", index=False)

# ── summary for the console / deck ──
print("=" * 62)
print("NEXT-BEST-OFFER — PORTFOLIO SUMMARY")
print("=" * 62)
print(f"Customers scored:            {len(out):,}")
print(f"Total book opportunity:      EUR {out['opportunity_value'].sum():,.0f}")
print(f"Average opportunity / cust:  EUR {out['opportunity_value'].mean():,.0f}")
print(f"Median opportunity / cust:   EUR {out['opportunity_value'].median():,.0f}")

print("\nNext-best-offer mix (which product wins most often):")
mix = out["next_best_offer"].value_counts()
for prod, n in mix.items():
    print(f"  {prod:<14} {n:>6,}  ({n/len(out):5.1%})")

print("\nWhere the opportunity value sits (sum of EV by NBO product):")
byprod = out.groupby("next_best_offer")["nbo_expected_value"].sum().sort_values(ascending=False)
for prod, v in byprod.items():
    print(f"  {prod:<14} EUR {v:>12,.0f}")

print("\nTop 5 opportunity customers:")
cols = ["opportunity_rank", "customer_id", "age", "balance",
        "next_best_offer", "nbo_expected_value", "opportunity_value"]
print(out[cols].head(5).to_string(index=False))

print("\nConcentration — top decile share of total opportunity:")
top10 = out.head(len(out) // 10)["opportunity_value"].sum()
print(f"  top 10% of customers hold {top10 / out['opportunity_value'].sum():.1%} of all opportunity value")

print("\nSaved: nbo_recommendations.csv")

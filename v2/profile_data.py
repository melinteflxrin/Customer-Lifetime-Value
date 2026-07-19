"""Phase 1 — profile the UCI Bank Marketing dataset (bank-full.csv).

Goal: understand size, the three products, class balance, and which
features look predictive, before any modeling.
"""
import pandas as pd

RAW = "bank_marketing_raw/bank-full.csv"
PRODUCTS = {
    "y": "Term deposit (campaign outcome — real buy/no-buy)",
    "housing": "Housing loan (current holding)",
    "loan": "Personal loan (current holding)",
}

df = pd.read_csv(RAW, sep=";")

print("=" * 70)
print(f"ROWS: {len(df):,}   COLUMNS: {df.shape[1]}")
print("=" * 70)

print("\n--- COLUMNS & TYPES ---")
for c in df.columns:
    kind = "num" if pd.api.types.is_numeric_dtype(df[c]) else "cat"
    nun = df[c].nunique()
    print(f"  {c:<12} {kind}  ({nun} unique)")

print("\n--- MISSINGNESS ---")
miss = df.isna().sum()
print("  none" if miss.sum() == 0 else miss[miss > 0].to_string())
# note: this dataset encodes missing as the literal string 'unknown'
print("\n--- 'unknown' counts per categorical col ---")
for c in df.select_dtypes("object").columns:
    n = (df[c] == "unknown").sum()
    if n:
        print(f"  {c:<12} {n:,} ({n/len(df):.1%})")

print("\n--- THE THREE PRODUCTS: uptake / holding rates ---")
for col, desc in PRODUCTS.items():
    rate = (df[col] == "yes").mean()
    print(f"  {col:<8} yes={rate:6.1%}   {desc}")

print("\n--- KEY NUMERIC FEATURES (summary) ---")
print(df[["age", "balance", "duration", "campaign", "pdays", "previous"]].describe().round(1).to_string())

# Quick predictive signal: how much does term-deposit uptake vary by feature?
print("\n--- TERM-DEPOSIT UPTAKE BY SELECTED SEGMENTS (signal check) ---")
tgt = (df["y"] == "yes")
for col in ["job", "education", "marital", "housing", "loan", "poutcome"]:
    print(f"\n  by {col}:")
    g = tgt.groupby(df[col]).agg(["mean", "size"]).sort_values("mean", ascending=False)
    for idx, row in g.iterrows():
        print(f"    {str(idx):<14} {row['mean']:6.1%}  (n={int(row['size']):,})")

# Age bucketed
print("\n  by age band:")
bands = pd.cut(df["age"], [0, 30, 40, 50, 60, 120])
g = tgt.groupby(bands, observed=True).agg(["mean", "size"])
for idx, row in g.iterrows():
    print(f"    {str(idx):<14} {row['mean']:6.1%}  (n={int(row['size']):,})")

print("\n--- CO-HOLDING: do the three products overlap? ---")
xtab = pd.crosstab(df["housing"], df["loan"], normalize="all")
print("  housing (rows) x loan (cols), share of book:")
print((xtab * 100).round(1).to_string())
print(f"\n  term-deposit uptake among housing-loan holders: {(df.loc[df['housing']=='yes','y']=='yes').mean():.1%}")
print(f"  term-deposit uptake among non-housing holders:  {(df.loc[df['housing']=='no','y']=='yes').mean():.1%}")

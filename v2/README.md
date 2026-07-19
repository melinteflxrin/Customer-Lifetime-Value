# Customer Value & Cross-Sell Propensity — PoC (v2)

A proof of concept that scores every bank customer for **how likely they are to buy each product**, turns that into **money**, and produces a **prioritised next-best-offer target list**. Built on the real, public UCI Bank Marketing dataset (45,211 customers).

> **Demo only.** Customers, attributes and the term-deposit buy/no-buy outcome are real; product money-values are made up and labelled as such. See `PLAN.md` §5 for the honest caveats.

## Open the deliverables

- **`dashboard.html`** — interactive dashboard. Double-click to open in any browser. No server needed.
- **`deck.html`** — presentation. Open in a browser; navigate with **← / →** arrow keys.

## Documents (the story, phase by phase)

| File | What it covers |
|---|---|
| `PLAN.md` | The reframe, decisions, caveats, 5-phase plan |
| `PHASE1_DATA_PROFILE.md` | The dataset and why it fits |
| `PHASE2_RESULTS.md` | The three propensity models + the lift result |
| `PHASE3-4_RESULTS.md` | Next-best-offer engine + book opportunity |

## Headline numbers

- **Term-deposit model:** AUC 0.806, **4.5× top-decile lift** — call the top 10% and reach **45%** of all buyers.
- **€20.8M** total book cross-sell opportunity; top 10% of customers hold ~24% of it.

## How it's built (pipeline)

```
bank_marketing_raw/bank-full.csv   (raw UCI data)
  → profile_data.py                (Phase 1: data profile)
  → train_propensity.py            (Phase 2: 3 models → scored_customers.csv, lift_data.csv, phase2_metrics.json)
  → nbo_engine.py                  (Phase 3+4: → nbo_recommendations.csv)
  → build_dashboard_data.py        (→ dashboard_data.json)
  → dashboard_template.html + inject → dashboard.html
```

## Reproduce

```bash
# from v2/ — uses the local venv created during the build
bank_marketing_raw/.venv/bin/python profile_data.py
bank_marketing_raw/.venv/bin/python train_propensity.py     # ~30s
bank_marketing_raw/.venv/bin/python nbo_engine.py
bank_marketing_raw/.venv/bin/python build_dashboard_data.py
# then re-inject dashboard_data.json into dashboard_template.html → dashboard.html
```

Dependencies: pandas, numpy, scikit-learn (installed in `bank_marketing_raw/.venv`).

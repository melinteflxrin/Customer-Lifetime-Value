# Phase 3 + 4 — Next-Best-Offer & Customer Value

**What we built:** an engine that turns the three propensity scores into money, picks each customer's single best next offer, and ranks the whole book by cross-sell opportunity value.

**Date:** 2026-07-19 · **Script:** `nbo_engine.py` · **Output:** `nbo_recommendations.csv`

---

## The core idea (one formula)

```
expected_value(product) = P(buy)  ×  product_value
next_best_offer         = the eligible product with the highest expected value
opportunity_value       = sum of expected values across a customer's eligible products
```

Value is **not** just "who's likely to buy" — it's "likely to buy × worth how much." A 20%-likely mortgage can beat a 40%-likely deposit because the mortgage is worth more. That interaction is the whole point.

**Eligibility rule:** we never recommend a product a customer already holds. Housing / personal loan are removed if already held; a term deposit can always be re-offered.

## Made-up product values (demo only — clearly labelled)

| Product | Assumed value | Basis |
|---|---|---|
| Term deposit | €300 + 5% of balance | Multi-year net interest margin on deposited funds (scales with wealth) |
| Housing loan | €1,500 | Lifetime margin on a mortgage (highest — realistic) |
| Personal loan | €800 | Lifetime margin on a personal loan |

These are **invented** figures. They were tuned so all three products are the same order of magnitude — otherwise the single most expensive product wins every recommendation and the models stop mattering. In a real project these come from the bank's product economics.

## Portfolio results

| Metric | Value |
|---|---|
| Customers scored | 45,211 |
| Total book opportunity | **€20.8M** |
| Average opportunity / customer | €461 |
| Median opportunity / customer | €182 |
| Top 10% of customers hold | **23.8%** of all opportunity value |

**Next-best-offer mix:**

| Best offer | Customers | Share |
|---|---|---|
| Personal Loan | 20,347 | 45.0% |
| Housing Loan | 20,073 | 44.4% |
| Term Deposit | 4,791 | 10.6% |

**Interpretation for the deck:**
- **Term deposit wins for high-balance savers** — its value scales with wealth, so for wealthy, high-propensity customers it becomes the top offer (they fill the top of the opportunity ranking).
- **Housing loan** carries the most total value (€14M) — it's the high-margin product, offered to the ~44% who don't already hold one.
- **Personal loan** is the fallback winner when a customer already holds a mortgage.
- The book's opportunity is **moderately concentrated** — the top 10% of customers hold ~24% of the value, so prioritised targeting pays off (but it's not a tiny whale-driven book).

## What each customer row now carries

`nbo_recommendations.csv` — one row per customer, ranked by opportunity:

- 3 propensity scores + 3 product values + 3 expected values
- `next_best_offer` — the single recommended product
- `nbo_expected_value` — what that best offer is worth in expectation
- `opportunity_value` — total expected cross-sell value across eligible products
- `opportunity_rank` — position in the book (1 = biggest opportunity)

This is the sales-ready artifact: *for every customer, what to offer, and what it's worth.*

## Honest notes

- Product values are invented; the **ranking within a product** is model-driven and real, the **cross-product money comparison** depends on the assumed values.
- `opportunity_value` sums expected values as if offers are independent; it's a prioritisation score, not a forecast of guaranteed revenue.
- No retention discount is applied here (this data has no churn signal — see the plan's retention-callback approach for Phase 5).

## Verdict

Green light for Phase 5. We now have everything the dashboard and deck need: proven propensity models, a per-customer recommendation, and a ranked opportunity list with a headline book value.

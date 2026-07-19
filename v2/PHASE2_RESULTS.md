# Phase 2 — Propensity Model Results

**What we built:** three calibrated classifiers, one per product, each outputting a `P(buy)` for every customer. Evaluated on a held-out 25% test set; dashboard scores are out-of-fold so no customer is scored by a model trained on them.

**Date:** 2026-07-19 · **Script:** `train_propensity.py`

---

## Headline results

| Product | Base rate | AUC | Top-decile lift | Top-decile capture |
|---|---|---|---|---|
| **Term deposit** | 11.7% | **0.806** | **4.5×** | **45%** |
| Housing loan | 55.6% | 0.866 | 1.7× | 17% |
| Personal loan | 16.0% | 0.713 | 2.6× | 26% |

**The money sentence for the boss (term deposit):**
> If we call only the **top 10%** of customers the model flags, we reach **45% of all the people who would say yes** — **4.5× better than dialing at random.** Same campaign, a quarter of the phone calls, nearly half the sales.

## How to read each column

- **AUC** — ranking quality (0.5 = coin flip, 1.0 = perfect). 0.70–0.87 here is solidly useful.
- **Top-decile lift** — the top 10% buy at N× the average rate.
- **Top-decile capture** — share of *all* buyers found in that top 10%.

## Why the two loans look different (honest read)

- **Housing loan** has a high AUC (0.866) but low lift (1.7×). That's expected: 55.6% of customers already hold it, so there's little room to "lift" above average — you can't concentrate a majority into the top decile. High AUC = we rank it well; low lift = limited targeting upside. Both true at once.
- **Personal loan** (2.6× lift) sits in between. It's a genuine, if weaker, look-alike signal.
- **Term deposit is the star** — it's the one with a real campaign buy/no-buy label, and it shows the strongest, cleanest targeting story. Lead the presentation with it.

## Calibration (are the probabilities honest?)

After fixing the CV fold bug (below), mean predicted term-deposit propensity is **0.127** vs an actual rate of **0.117** — well calibrated. Response rate rises monotonically with the score (bottom bin ~3% actual → top bin ~45% actual), so the numbers can be read as real probabilities, not just rankings.

## A real bug we caught (worth a footnote in the deck — shows rigor)

The first run produced **inverted** dashboard scores: the highest-predicted customers had the *lowest* actual uptake. Cause: the UCI data is ordered **chronologically by campaign**, and the default cross-validation split (`KFold`, no shuffle) cut it into contiguous time blocks with very different response rates, so out-of-fold scores trained on one period and predicted another. Fix: **stratified, shuffled** folds. The held-out headline metrics were never affected (that split shuffles by default) — only the per-customer scores, now corrected.

*Takeaway for the deck:* time-ordered data needs time-aware validation. Naming this makes the PoC look more credible, not less.

## Feature discipline

- **`duration` excluded** everywhere — leakage (only known after the call).
- When scoring a product, its own column is dropped; the other two products stay in as behavioural signal (this is what surfaces the "housing holders are cooler on term deposits" interaction).

## Outputs produced

| File | Contents |
|---|---|
| `scored_customers.csv` | 45,211 customers × 3 propensity scores + key attributes |
| `lift_data.csv` | decile-level cumulative gains & lift per product (for the dashboard chart) |
| `phase2_metrics.json` | the metrics table above, machine-readable |

## Verdict

Green light for Phase 3 (next-best-offer engine). The term-deposit model alone is a convincing centrepiece; the two loans round out the multi-product story with honest caveats already documented.

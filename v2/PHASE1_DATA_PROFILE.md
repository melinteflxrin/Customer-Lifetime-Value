# Phase 1 — Data Profile

**Dataset:** UCI Bank Marketing (`bank-full.csv`)
**Rows:** 45,211 customers · **Columns:** 17 · **Missing:** none (some categoricals use the literal string `"unknown"`)
**Date:** 2026-07-19

---

## The three products (our next-best-offer set)

| Product | Field | Yes-rate | Signal type |
|---|---|---|---|
| **Term deposit** | `y` | **11.7%** | Real campaign buy/no-buy (gold standard) |
| **Housing loan** | `housing` | **55.6%** | Current holding (look-alike) |
| **Personal loan** | `loan` | **16.0%** | Current holding (look-alike) |

Term deposit is imbalanced (~12% positive) — normal for propensity work; we'll evaluate with lift/AUC, not raw accuracy.

## Features available

- **Demographic:** age, job, marital, education
- **Financial:** balance (account balance — useful for the value layer), default flag
- **Behavioural / campaign:** contact type, month, day, campaign (# contacts), pdays, previous, poutcome (previous campaign result)

## Predictive signal is strong and interpretable

Term-deposit uptake varies sharply by segment — the model will have real signal to learn:

- **Previous campaign success** → 64.7% uptake (vs 9.2% baseline). Strongest single driver.
- **Life stage:** students 28.7%, retired 22.8%, and the 60+ age band 42.3% — vs blue-collar 7.3%.
- **Age is U-shaped:** young (<30) 16.3% and elderly (60+) 42.3% are high; middle-aged dips to ~9–10%.
- **Cross-product interaction (nice for the NBO story):** housing-loan holders are *less* likely to take a term deposit (7.7% vs 16.7%). Products compete for the same wallet — exactly the kind of insight next-best-offer is meant to surface.

## Modeling caveat to carry forward (important, professional detail)

**`duration`** (call length) is a known **leakage** feature: it's only known *after* a customer is contacted, so it can't be used to decide *who to target beforehand*. UCI flags this explicitly. We will **exclude `duration`** from the propensity features so the demo reflects a realistic "score the book before calling" scenario. (We can show it as a footnote — it makes us look like we know what we're doing.)

## Verdict

Green light for Phase 2. The data is clean, real, has three usable products, strong interpretable signal, and a `balance` field to anchor the value layer. No blockers.

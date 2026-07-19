# Customer Value & Cross-Sell Propensity — Proof of Concept (v2)

**Status:** All 5 phases complete — dashboard.html + deck.html built and verified
**Type:** R&D / proof of concept for a possible future bank engagement
**Owner:** Florin
**Last updated:** 2026-07-19

> **Framing:** This is a **playground demo**, not a pre-build of a real project. No bank engagement is confirmed, and we don't yet know how any real bank data would look. The only goal is to prove to leadership that we *could* build something like this if a bank asks. So: use whatever public data fits, make up numbers where convenient (labelled as made up), and optimise for a clear, convincing demo over production realism.

---

## 1. Why v2 exists

The v1 work built a **churn-first CLV**: it answered *"how much current profit do we lose if this customer leaves?"* Value there meant **protecting what already exists**.

After discussion, the brief changed. The new emphasis is **growth, not just retention**:

> Predict whether the bank can *sell a product* to a customer based on their behaviour, and express a customer's value in terms of *what we can sell them* and *how long we keep them*.

That is a different, well-established modeling problem: **propensity-to-buy / next-best-product / cross-sell modeling**. Retention (the v1 churn model) stops being the whole story and becomes one supporting leg.

New guiding definition of value:

> **Customer value = (products we can likely sell them) × (product value) × (how long we keep them)**

The centrepiece becomes: *"Given this customer's behaviour, which product are they likely to buy next, and what is that worth?"*

---

## 2. What we keep, drop, and change from v1

| From v1 | Decision in v2 | Reason |
|---|---|---|
| Kaggle bank-churn dataset | **Replace** as the primary source | Only has a product *count* + credit-card flag; no per-product buy/no-buy signal, which a propensity model must learn from |
| Churn Random Forest model | **Demote to a supporting "retention" idea** | Retention is now one leg, not the whole metric |
| Discounted multi-year CLV math | **Reuse** where a value/horizon view is needed | The discounting logic is sound and reusable |
| Synthetic revenue / FTP / PD fields | **Reuse only as disclosed placeholders** for product value | Fine for a PoC as long as it is labelled as assumed, not real |
| Static multi-tab web dashboard shell | **Reuse and re-skin** | Good bones; just needs a new story |
| "Inference paradox" survival hack | **Drop** | Fragile; better to output calibrated probabilities directly |

---

## 3. Decisions locked

| Decision | Choice | Note |
|---|---|---|
| **Data source** | UCI Bank Marketing (real public bank dataset) | Contains genuine "subscribed to a product: yes/no" signal |
| **Scope** | Multi-product next-best-offer | Rank products per customer, recommend the single best next offer |
| **Value focus** | Expected cross-sell value | Retention leg is light on this data (see caveats) |

---

## 4. The dataset

**UCI Bank Marketing** — real, well-known, defensible, fast to work with.

It gives us a genuine multi-product set for next-best-offer:

| Product | Signal type | Strength |
|---|---|---|
| **Term deposit** | True buy / no-buy campaign response (the target `y`) | Strong — the gold-standard "will they buy" signal |
| **Housing loan** | Current holding (yes/no) | Look-alike propensity |
| **Personal loan** | Current holding (yes/no) | Look-alike propensity |

Feature material includes customer attributes (age, job, marital status, education, balance), contact/campaign history, and macro/timing fields.

---

## 5. Two honest caveats (disclosed up front)

These are stated openly in the final deck — naming them is part of doing credible R&D, not a weakness.

1. **Multi-product = 1 real target + 2 look-alike.** The term deposit has a true campaign buy/no-buy outcome. The two loans are modeled as *look-alike* propensity from current holdings. This is exactly how banks bootstrap propensity **before** they have full campaign history for every product — a realistic starting posture.
2. **No churn / tenure in this data → the retention leg is weak.** So the PoC value metric is **cross-sell-focused** (propensity × product value). Retention is covered by a **single callback slide** that shows the existing v1 churn work already exists — proving the retention half is within reach with no new modeling needed (see Phase 5).

---

## 6. The plan (phased)

### Phase 1 — Data foundation
- Pull UCI Bank Marketing; profile it (size, class balance, missingness).
- Confirm the three products and the behavioural features that look predictive.
- **Output:** a short data-profile note + a clean modeling table.

### Phase 2 — Propensity models
- One **calibrated** classifier per product → `P(buy)` for each of the three products.
- Evaluate with business-friendly metrics: **top-decile capture / lift chart**, AUC, calibration.
- **Output:** three propensity scores per customer + a "this actually predicts" evidence chart.

### Phase 3 — Next-best-offer engine
- Per customer, rank the three products by `P(buy) × product_value`.
- Emit the single **best next offer** per customer.
- **Output:** a per-customer recommendation table.

### Phase 4 — Value score
- Expected cross-sell value per customer = Σ (propensity × product value) across products.
- Rank the whole book by opportunity value.
- **Output:** a ranked target list — who to approach first and why.

### Phase 5 — Dashboard + deck
- Re-skin the v1 dashboard around the new story: **who to target, with which product, worth how much.**
- Build a short slide narrative explaining the work and how it maps to what a real bank would need in production.
- Include **one retention callback slide**: show the existing v1 churn work to prove the retention half is also within reach — no new modeling, just a "we've already done this piece elsewhere" reference.
- **Output:** the presentation-ready PoC.

---

## 7. What "success" looks like for the PoC

- A working pipeline from raw data → per-customer next-best-offer + value score.
- One clear chart proving the propensity model beats random targeting (lift).
- A dashboard and deck a non-technical boss can follow in a few minutes.
- Honest framing of what is real vs. assumed, and what production would add.

*This is a proof of concept: the goal is to show the approach is feasible and valuable, not to ship a production-grade model.*

---

## 8. Product value assumptions (made up — playground)

Each product needs a dollar value to turn propensity into money (value = propensity × product worth). Since this is a demo, these are **invented figures, clearly labelled as made up** in the dashboard and deck. Exact numbers are set in Phase 4; the point is only to make the value ranking work, not to be accurate.

| Product | Made-up value basis |
|---|---|
| Term deposit | Assumed net interest margin on a typical deposit |
| Housing loan | Assumed lifetime margin on a housing loan |
| Personal loan | Assumed lifetime margin on a personal loan |

---

## 9. Resolved questions

- **Real bank data?** Not confirmed — treat this purely as a playground. Do **not** engineer toward an unknown real schema.
- **Product margins?** Made up for the demo, labelled as such (see section 8).
- **Retention leg?** Middle path — demo stays focused on cross-sell; a single Phase 5 slide calls back to the v1 churn work to show the retention half is also reachable.

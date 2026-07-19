# CLV Dashboard Guide

## Purpose

This project turns raw bank customer data into a risk-adjusted Customer Lifetime Value view that a bank can use for executive reporting and portfolio prioritization.

The dashboard is designed as a proof of concept for leadership audiences, so the emphasis is on clarity, decision-making, and business interpretation rather than model technical depth.

## What We Built

The final dashboard is a static multi-tab web dashboard that can be opened directly in a browser. It includes:

- Executive Summary
- Value & Risk Segmentation
- Value Drivers
- Portfolio Deep Dive

The dashboard reads from `final_clv_dashboard_data.csv`, which is the corrected dataset used for all charts and KPIs.

## Data Flow

The project follows this pipeline:

1. `bank_churn.csv` is the original customer churn dataset.
2. `bank_churn_enriched_for_CLV.csv` adds synthetic financial fields such as revenue, FTP cost, allocated cost, and PD risk.
3. `predictions_churn.csv` adds churn model outputs and engineered features.
4. `final_clv_dashboard_data.csv` contains the final CLV fields used by the dashboard.
5. `dashboard/dashboard_data.js` is a browser-friendly copy of the final CSV.

## Portfolio Snapshot

Current dataset summary after correction:

- Rows: 10,000 customers
- Total Risk-Adjusted CLV: 21,736,849.92
- Average Risk-Adjusted CLV: 2,173.68
- Median Risk-Adjusted CLV: 1,341.69
- Negative CLV accounts: 1,016 customers
- Predicted churners: 2,783 customers
- Average PD risk: 0.0799
- Average prediction confidence: 0.6775
- Projection horizon: 5 years
- Discount rate: 10%

This tells us the portfolio has a meaningful value base, but also a visible remediation population with negative value or elevated churn risk.

## Core Formula Logic

### 1. Base Revenue

In the CLV build script, base revenue is a synthetic operating revenue proxy:

$$
Base\_Revenue = \max\left(50, \left(0.04 \times Balance + 0.005 \times Estimated\_Salary\right) \times Noise\right)
$$

Where `Noise` is a random multiplier centered around 1.0. This was used to simulate realistic variation in revenue generation.

### 2. FTP Cost

Funds Transfer Pricing is modeled as a percentage of base revenue:

$$
FTP\_Cost = Base\_Revenue \times FTP\_Pct
$$

The percentage is randomly sampled between 20% and 30% in the build script.

### 3. Allocated Cost

Service cost is modeled from product usage and activity:

$$
Allocated\_Cost = 100 + 50 \times Products\_Number + 25 \times Active\_Member
$$

This gives a higher cost burden to more complex or more active relationships.

### 4. PD Risk

Credit default risk is calculated from credit score:

$$
PD\_Risk = \text{clip}\left(\frac{850 - Credit\_Score}{2500}, 0.005, 0.25\right)
$$

Interpretation:

- Higher credit scores produce lower default risk.
- Lower credit scores produce higher default risk.
- The value is bounded so it never falls below 0.5% and never exceeds 25% in the build logic.

In the current final dataset, observed PD risk ranges from 0.005 to 0.20.

### 5. Survival Probability

The final dataset uses the corrected survival logic:

- If `PredictedValue = 1` (predicted churn), then:

$$
Survival = 1 - PredictionConfidencePercentage
$$

- If `PredictedValue = 0` (predicted stay), then:

$$
Survival = PredictionConfidencePercentage
$$

This matters because the model confidence is confidence in the predicted class, not a universal churn probability.

### 6. Final Risk-Adjusted CLV — Multi-Year Discounted Cash Flow

The customer value formula projects the risk-adjusted margin forward over a declared time horizon, discounting future cash flows to today's value:

$$
Net\_Operating\_Margin = Base\_Revenue - FTP\_Cost - Allocated\_Cost
$$

$$
Risk\_Adjusted\_Margin = Net\_Operating\_Margin \times (1 - PD\_Risk)
$$

$$
Risk\_Adjusted\_CLV = Risk\_Adjusted\_Margin \times \sum_{t=1}^{T} \frac{Survival^t}{(1 + d)^t}
$$

Where **T = 5 years** (projection horizon) and **d = 10%** (discount rate / cost of capital).

These are declared business assumptions that should be validated against the institution's actual hurdle rate and planning horizon in production.

Interpretation:

- Positive CLV means the customer is profitable after cost and risk adjustments.
- Negative CLV means the customer is currently unprofitable under the modeled assumptions.
- Higher CLV means more relationship value to protect and retain.

## Column Guide

### Identity and Segmentation

- `CUSTOMER_ID`: Unique customer identifier.
- `GENDER`: Customer gender.
- `AGE`: Customer age.
- `AGE_SQ`: Age squared, used for non-linear effects.
- `AGE_GROUP`: Age band used for segmentation charts.
- `TENURE`: Relationship length in years.
- `TENURE_SQ`: Tenure squared, used for non-linear effects.
- `TENURE_GROUP`: Tenure band used for segmentation charts.
- `CREDIT_TIER`: Credit score band.
- `PRODUCT_SEGMENT`: Segment based on product mix.

### Financial Profile

- `CREDIT_SCORE`: Raw credit score used in PD risk calculation.
- `BALANCE`: Account balance.
- `ESTIMATED_SALARY`: Estimated customer income.
- `BALANCE_SALARY_RATIO`: Balance divided by estimated salary.
- `HAS_ZERO_BALANCE`: Flag for empty or near-empty balance.

### Product and Behavior

- `PRODUCTS_NUMBER`: Number of products held.
- `CREDIT_CARD`: Flag showing whether the customer has a credit card.
- `ACTIVE_MEMBER`: Flag indicating active engagement.
- `HEALTH_SCORE`: Composite engagement/health indicator.
- `AGE_TENURE_INTERACTION`: Interaction term between age and tenure.

### Churn Model Outputs

- `CHURN`: Historical ground-truth churn label.
- `PredictedValue`: Model prediction, where 0 means stay and 1 means churn.
- `PredictionConfidencePercentage`: Confidence in the predicted class.
- `PredictionGroup`: Rule-based cluster or bucket used to describe the model segment.
- `Survival_Probability`: Corrected survival probability used in final CLV.

### Revenue, Cost, and Risk Fields

- `Base_Revenue`: Synthetic revenue proxy before costs.
- `FTP_Cost`: Funds Transfer Pricing cost.
- `Allocated_Cost`: Service and handling cost.
- `PD_Risk`: Probability of default.
- `Risk_Adjusted_CLV`: Final risk-adjusted customer value.

## How to Read the Dashboard

### Executive Summary Tab

This tab is the best starting point for leadership.

- **Total Risk-Adjusted CLV** shows the value of the currently filtered portfolio.
- **Average CLV** shows the typical customer value in the selected segment.
- **Predicted Churn Rate** shows the share of customers the model expects to leave.
- **Negative CLV Accounts** shows the volume of customers who are currently unprofitable after risk adjustment.

#### Value vs Risk Quadrant

This scatter plot places customers by:

- X-axis: churn probability
- Y-axis: risk-adjusted CLV

How to interpret the quadrants:

- High CLV, low churn: protect and grow.
- High CLV, high churn: top retention priority.
- Low CLV, low churn: stable but lower-value customers.
- Low CLV, high churn: lowest priority or remediation candidates.

#### Churn Outlook Donut

This chart shows the share of predicted loyal customers versus predicted churners in the filtered portfolio.

- A larger churn slice means the portfolio has more retention pressure.
- A larger loyal slice means the portfolio is more stable.

#### High-Value, High-Risk Table

This table surfaces customers with both strong value and elevated churn probability. These are the best candidates for proactive retention campaigns.

### Value & Risk Segmentation Tab

These bar charts show average CLV by segment:

- Age group
- Tenure group
- Credit tier
- Product segment

How to interpret them:

- Taller bars mean the segment generates more average value.
- Shorter bars mean the segment is less valuable on average.
- This tab is for identifying which customer groups deserve growth, retention, or cross-sell attention.

### Value Drivers Tab

#### Value Bridge

This is an average bridge from revenue to final CLV.

Interpretation of the steps:

- Base Revenue: gross starting value.
- FTP: capital funding cost reduces value.
- Allocated Cost: servicing cost reduces value.
- PD Impact: credit risk reduces value.
- Survival: retention effect reduces or preserves value.
- Final CLV: final expected relationship value.

Important note: this is a decision-support bridge, not a strict accounting waterfall.

#### Behavioral Health Snapshot

This histogram shows the distribution of `HEALTH_SCORE`.

- A shift toward higher scores means customers are generally more engaged.
- A heavy concentration at low scores suggests weaker activity and possible retention risk.

#### Key Drivers Overview

This chart shows the correlation between CLV and selected drivers:

- `BALANCE`
- `PRODUCTS_NUMBER`
- `HEALTH_SCORE`
- `CREDIT_SCORE`
- `TENURE`

Interpretation of correlation values:

- Close to +1: strong positive relationship.
- Close to -1: strong negative relationship.
- Close to 0: weak linear relationship.

Important note: correlation does not prove causation.

### Portfolio Deep Dive Tab

#### CLV Distribution

This histogram shows how CLV values are spread across the filtered portfolio.

- A wider spread means the portfolio contains both low and high value customers.
- A left-skewed tail indicates a larger loss-making or low-value population.

#### Segment Mix

This donut shows the composition of the filtered portfolio by product segment.

- Useful for seeing whether the portfolio is concentrated in one segment.
- Useful for spotting if a segment dominates value or risk.

#### Customer Explorer

This table is the drilldown layer.

It helps users inspect individual accounts and compare:

- CLV
- Churn probability
- Balance
- Credit tier
- Tenure
- Product count
- Activity flag

## How to Interpret the Main Values

### Risk-Adjusted CLV

This is the primary value metric.

- Positive number: profitable expected relationship value.
- Near zero: marginal relationship.
- Negative number: relationship is expected to destroy value under current assumptions.

### PD Risk

This is the model-based credit risk component.

- Lower value means safer customer.
- Higher value means more credit risk.

### Prediction Confidence Percentage

This is not a universal churn probability.

It is the model’s confidence in the predicted class.

That is why the dashboard and final CLV calculation must convert it into survival probability conditionally.

### Survival Probability

This is the retention probability used in CLV.

- Higher means the customer is more likely to remain with the bank.
- Lower means the customer is more likely to leave.

## Important Modeling Notes

- The revenue and cost fields are engineered for the PoC and are not raw ledger values.
- The final dashboard is useful for presentation and prioritization, but production use would require validation against real finance and customer economics.
- The PD risk formula is a simplified mapping from credit score to default risk.
- The churn model output is class-based, so the dashboard corrects the survival logic before final value calculation.

## Why This Version Matters

The dataset was corrected because the earlier CLV logic used a simplified survival treatment. The corrected version now respects the model output semantics:

- predicted churner means survival should be `1 - confidence`
- predicted loyal customer means survival should be `confidence`

That correction is important because it changes the value ranking of customers and prevents loyal customers from being misclassified as lower value.

## Recommended Executive Message

If you present this to another bank, the simplest message is:

This dashboard converts customer risk, profitability, and retention into one portfolio value metric so the bank can identify where to protect value, where to intervene, and where to grow.

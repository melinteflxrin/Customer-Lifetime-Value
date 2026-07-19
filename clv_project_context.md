markdown_content = """# Customer Lifetime Value (CLV) & Attrition Optimization Project
## Technical Reference Blueprint for GitHub Copilot

This document serves as the absolute source of truth and structural context for the Customer Lifetime Value (CLV) data pipeline. It contains the project background, full column schema definitions, business rules, mathematical formulas, and critical algorithmic logic required to process the data programmatically using Python inside VSCode.

---

## 1. Project Background & Executive Context
Traditional financial management systems inside retail banking often evaluate customer value statically using simple indicators such as gross balance or gross revenue. This creates an operational blind spot, treating resource-heavy, high-churn-risk accounts as premier relationships, while ignoring baseline margins and systemic risk.

This project addresses that gap by building an end-to-end predictive data pipeline that blends **Machine Learning Classifiers** (to determine behavioral attrition probability), **Activity-Based Costing (ABC)** (to model true service costs), **Funds Transfer Pricing (FTP)** (to account for raw capital cost), and **Credit Default Risk (Probability of Default - PD)**. 

The ultimate goal is to convert top-line metrics into a singular, highly actionable **Risk-Adjusted Customer Lifetime Value (CLV)** metric for a portfolio of ~10,000 customers.

---

## 2. Definitive Dataset Schema (Source File Context)
The current input file contains a mixture of engineered demographic variables, raw financial metrics, and machine learning inferences generated via a Random Forest Binary Classification Algorithm.

Below is the exact schema mapping of your active dataset (`final_clv_dataset`) as verified by your data schema layout. Ensure all code blocks written via Copilot match these case-sensitive column headers precisely:

### Demographic & Behavioral Features
* **`CUSTOMER_ID`** *(String / Categorical Attribute)*: The unique primary identification key for each bank client. Should be handled strictly as a category name tag, never aggregated or treated as a numeric value.
* **`GENDER`** *(String)*: Biological sex of the account holder (`Male`, `Female`).
* **`AGE`** *(Numeric)*: Continuous integer representing customer age.
* **`AGE_SQ`** *(Numeric)*: Squared value of age ($Age^2$) used to capture non-linear behavioral shifts in lifecycle banking.
* **`AGE_GROUP`** *(Categorical Attribute)*: Discrete categorical age bracket.
* **`TENURE`** *(Numeric)*: Total number of years the customer has maintained an active account history with the bank.
* **`TENURE_SQ`** *(Numeric)*: Squared tenure value ($Tenure^2$).
* **`TENURE_GROUP`** *(Categorical Attribute)*: Discrete categorical tenure bracket.

### Financial Profile Indicators
* **`CREDIT_SCORE`** *(Numeric)*: Standardized consumer creditworthiness metric (350–850 range).
* **`CREDIT_TIER`** *(Categorical Attribute)*: Discretized grading tier based on the credit score.
* **`BALANCE`** *(Numeric)*: Total aggregate funds currently deposited in the client's bank accounts.
* **`ESTIMATED_SALARY`** *(Numeric)*: Model-derived monthly or annual annualized cash inflow estimation.
* **`BALANCE_SALARY_RATIO`** *(Numeric)*: Engineered interaction variable calculated as $\\frac{\\text{BALANCE}}{\\text{ESTIMATED\_SALARY}}$.
* **`HAS_ZERO_BALANCE`** *(Binary Flag: 0 or 1)*: Indicator column marking clients who hold empty or near-empty deposit structures.

### Engagement & Product Footprint
* **`PRODUCTS_NUMBER`** *(Numeric Integer)*: Total count of core bank products utilized by the customer (e.g., checking, savings, mortgage, personal loan).
* **`PRODUCT_SEGMENT`** *(Categorical Attribute)*: Profile grouping derived from product combinations.
* **`CREDIT_CARD`** *(Binary Flag: 0 or 1)*: Indicator flag marking whether the customer holds an active credit line with the institution.
* **`ACTIVE_MEMBER`** *(Binary Flag: 0 or 1)*: Behavioral classification marking whether the user actively transacts via mobile, web, or branch locations.
* **`HEALTH_SCORE`** *(Numeric)*: Composite behavioral index mapping general customer health and system engagement.
* **`AGE_TENURE_INTERACTION`** *(Numeric)*: Interaction terms calculated as $\\text{AGE} \\times \\text{TENURE}$.

### Machine Learning Model Inferences (Target & Outputs)
* **`CHURN`** *(Categorical Label)*: Historical ground-truth flag (`1` for left, `0` for stayed) used during the initial training set execution.
* **`PredictedValue`** *(Binary Target Inference: 0 or 1)*: The machine learning model's final binary classification guess for whether the account will remain or depart within the next 12 months.
  * `0` = Model predicts the customer will **STAY**.
  * `1` = Model predicts the customer will **CHURN**.
* **`PredictionConfidencePercentage`** *(Numeric Probability: 0.00 to 1.00)*: The underlying prediction confidence score. *Crucial:* This represents the confidence for the specific classification decision made in `PredictedValue`, not a direct global probability of attrition.
* **`PredictionGroup`** *(String)*: Algorithmic clustering categorization based on inference scoring.

### Synthesized Base Financial Metrics
* **`Base_Revenue`** *(Numeric Float)*: The initial gross revenues generated prior to cost deductions. 
* **`FTP_Cost`** *(Numeric Float)*: Funds Transfer Pricing cost of capital. Stored as an absolute positive amount representing a debit.
* **`Waterfall_FTP`** *(Numeric Float)*: Reporting-specific copy of FTP cost stored as a negative number (`FTP_Cost * -1`).
* **`Allocated_Cost`** *(Numeric Float)*: Internal activity-based cost assigned to the customer for servicing expenses. Stored as an absolute positive.
* **`Waterfall_Allocated`** *(Numeric Float)*: Reporting-specific copy of allocated servicing cost stored as a negative number (`Allocated_Cost * -1`).
* **`PD_Risk`** *(Numeric Probability: 0.0000 to 1.0000)*: Probability of Default mapping credit risk based on historical scores.

---

## 3. The Core Algorithmic Quirk (The "Inference Paradox")
When writing scripts with GitHub Copilot to extract true survival metrics from this dataset, you must account for the custom behavior of classification outputs.

### The Problem
If you blindly calculate survival as `(1 - PredictionConfidencePercentage)`, your final valuations will be inverted, causing your most loyal customers to show artificially penalized valuations. This happens because the model outputs **the confidence of its decision**, rather than a flat global churn metric.

### The Algorithmic Interpretation Mapping
To capture a client's **True Survival Probability ($S$)**, your Python logic must parse the columns conditionally:

1. **When `PredictedValue == 1` (Predicted Churner):**
   * The model is confident the customer will *leave*.
   * Therefore, Churn Probability = `PredictionConfidencePercentage`.
   * **True Survival Probability ($S$)** = $1 - \\text{PredictionConfidencePercentage}$

2. **When `PredictedValue == 0` (Predicted Loyalist):**
   * The model is confident the customer will *stay*.
   * Therefore, Churn Probability = $1 - \\text{PredictionConfidencePercentage}$.
   * **True Survival Probability ($S$)** = $\\text{PredictionConfidencePercentage}$

---

## 4. Financial Engineering & Calculations Blueprint
The project pipeline uses a modular calculation layer to build the ultimate dynamic target variable: `Risk_Adjusted_CLV`.

### Step A: Net Economic Margin Calculation
Calculate the baseline operating profitability of the customer relationship by stripping out capital costs and servicing overhead:
$$\\text{Net Operating Margin} = \\text{Base\_Revenue} - \\text{FTP\_Cost} - \\text{Allocated\_Cost}$$

### Step B: Credit Risk Penalty
Discount the Net Operating Margin by the customer's individual probability of default to protect the portfolio value from bad debt assumptions:
$$\\text{Risk-Adjusted Margin} = \\text{Net Operating Margin} \\times (1 - \\text{PD\_Risk})$$

### Step C: Attrition Survival Discount (The Final CLV Equation)
Multiply the Risk-Adjusted Margin against the True Survival Probability ($S$) mapped out in Section 3 to produce the final comprehensive metric:
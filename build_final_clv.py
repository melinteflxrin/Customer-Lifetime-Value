import numpy as np
import pandas as pd


# ── Business assumptions (declared explicitly for PoC transparency) ──
DISCOUNT_RATE = 0.10   # 10% cost of capital / hurdle rate
HORIZON_YEARS = 5      # 5-year forward projection window


def multi_year_clv(risk_adj_margin: np.ndarray, survival: np.ndarray) -> np.ndarray:
    """
    Compute discounted multi-year CLV using a geometric series.

    CLV = Σ_{t=1}^{T}  Risk_Adjusted_Margin × survival^t / (1 + d)^t

    Closed-form solution: margin × ratio × (1 - ratio^T) / (1 - ratio)
    where ratio = survival / (1 + d)
    """
    ratio = survival / (1 + DISCOUNT_RATE)
    # Edge case guard: ratio == 1 would cause division by zero in closed form
    clv_factor = np.where(
        ratio == 1,
        HORIZON_YEARS / (1 + DISCOUNT_RATE),
        ratio * (1 - ratio ** HORIZON_YEARS) / (1 - ratio),
    )
    return risk_adj_margin * clv_factor


def main() -> None:
    input_path = "predictions_churn.csv"
    output_path = "final_clv_dashboard_data.csv"

    df = pd.read_csv(input_path)

    # ── Revenue & cost engineering ──
    rng = np.random.default_rng(42)
    noise = rng.normal(loc=1.0, scale=0.1, size=len(df))
    base_revenue = (0.04 * df["BALANCE"] + 0.005 * df["ESTIMATED_SALARY"]) * noise
    df["Base_Revenue"] = np.clip(base_revenue, 50, None).round(2)

    ftp_pct = rng.uniform(0.20, 0.30, size=len(df))
    df["FTP_Cost"] = (df["Base_Revenue"] * ftp_pct).round(2)

    allocated_cost = 100 + (50 * df["PRODUCTS_NUMBER"]) + (25 * df["ACTIVE_MEMBER"])
    df["Allocated_Cost"] = allocated_cost.round(2)

    pd_risk = (850 - df["CREDIT_SCORE"]) / 2500
    df["PD_Risk"] = np.clip(pd_risk, 0.005, 0.25).round(4)

    # ── Survival probability (corrected inference-paradox logic) ──
    conf_cols = [col for col in df.columns if col.startswith("PredictionConfidence")]
    if not conf_cols:
        raise ValueError("No column starts with 'PredictionConfidence'.")
    conf_col = conf_cols[0]

    survival = np.where(
        df["PredictedValue"].astype(int) == 1,
        1 - df[conf_col],
        df[conf_col],
    )
    df["Survival_Probability"] = survival.round(4)

    # ── CLV calculation ──
    # Step A: single-period risk-adjusted margin (stored for dashboard waterfall)
    net_margin = df["Base_Revenue"] - df["FTP_Cost"] - df["Allocated_Cost"]
    risk_adj_margin = net_margin * (1 - df["PD_Risk"])
    df["Risk_Adjusted_Margin"] = risk_adj_margin.round(2)

    # Step B: project margin forward over HORIZON_YEARS at DISCOUNT_RATE
    df["Risk_Adjusted_CLV"] = multi_year_clv(risk_adj_margin.values, survival).round(2)

    print(
        df[
            [
                "Base_Revenue",
                "FTP_Cost",
                "Allocated_Cost",
                "PD_Risk",
                "Survival_Probability",
                "Risk_Adjusted_Margin",
                "Risk_Adjusted_CLV",
            ]
        ].head()
    )
    print(f"\nAssumptions: Discount Rate={DISCOUNT_RATE:.0%}, Horizon={HORIZON_YEARS} years")
    print(f"Total CLV:   ${df['Risk_Adjusted_CLV'].sum():>15,.2f}")
    print(f"Average CLV: ${df['Risk_Adjusted_CLV'].mean():>15,.2f}")
    print(f"Median CLV:  ${df['Risk_Adjusted_CLV'].median():>15,.2f}")
    print(f"Negative CLV accounts: {(df['Risk_Adjusted_CLV'] < 0).sum()}")

    df.to_csv(output_path, index=False)
    print(f"\nSaved final CLV dataset to {output_path}")


if __name__ == "__main__":
    main()

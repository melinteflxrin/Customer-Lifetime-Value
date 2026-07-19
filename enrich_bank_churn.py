import numpy as np
import pandas as pd


def main() -> None:
    input_path = "bank_churn.csv"
    output_path = "bank_churn_enriched_for_CLV.csv"

    df = pd.read_csv(input_path)

    rng = np.random.default_rng(42)
    noise = rng.normal(loc=1.0, scale=0.1, size=len(df))
    base_revenue = (0.04 * df["balance"] + 0.005 * df["estimated_salary"]) * noise
    df["Base_Revenue"] = np.clip(base_revenue, 50, None).round(2)

    ftp_pct = rng.uniform(0.20, 0.30, size=len(df))
    df["FTP_Cost"] = (df["Base_Revenue"] * ftp_pct).round(2)

    allocated_cost = 100 + (50 * df["products_number"]) + (25 * df["active_member"])
    df["Allocated_Cost"] = allocated_cost.round(2)

    pd_risk = (850 - df["credit_score"]) / 2500
    df["PD_Risk"] = np.clip(pd_risk, 0.005, 0.25).round(4)

    print(df[["customer_id", "Base_Revenue", "FTP_Cost", "Allocated_Cost", "PD_Risk"]].head())

    df.to_csv(output_path, index=False)
    print(f"Saved enriched dataset to {output_path}")


if __name__ == "__main__":
    main()

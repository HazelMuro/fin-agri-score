"""Deeper look at anon_df (2).csv - the richest farmer-level source."""
import pandas as pd

P = r"C:\Users\user\OneDrive\Desktop\final\data\anon_df (2).csv"
df = pd.read_csv(P, low_memory=False)
print("Shape:", df.shape)
print("adm0 unique:", df["adm0_name"].unique() if "adm0_name" in df else "n/a")
print("adm1 unique:", df.get("adm1_name", pd.Series([])).unique()[:20])
print("round unique:", df.get("round", pd.Series([])).unique())
print("survey_date range:", df.get("survey_date", pd.Series([])).min(),
      "->", df.get("survey_date", pd.Series([])).max())
print()
print("--- Columns (all 286) ---")
for i, c in enumerate(df.columns):
    print(f"{i:3d}  {c}")
print()
print("--- Outcome-ish columns of interest ---")
for col in [
    "hhs", "p_mod", "p_sev", "lcsi", "hdds_score", "hdds_class",
    "shock_count", "tot_income", "income_main_amount",
    "need", "need_received_food", "need_received_other",
    "fies_worried", "fies_hungry", "fies_ranout", "fies_skipped", "fies_whlday",
    "risk_label", "total_risk_score",
]:
    if col in df.columns:
        if df[col].dtype == object:
            print(f"\n{col} (object):")
            print(df[col].value_counts(dropna=False).head(10))
        else:
            print(f"\n{col} ({df[col].dtype}):")
            print(df[col].describe())

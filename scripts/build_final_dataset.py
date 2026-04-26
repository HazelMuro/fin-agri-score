"""
Build the final farmer credit-risk dataset by merging multiple sources.

Base            : DIEM Zimbabwe Round 4 farmer survey (anon_df (2).csv, 1,988 farmers)
GEE             : CHIRPS rainfall + MODIS NDVI (from old dataset, joined by admin2)
Regional yield  : hvstat_africa_data_v1.0.csv (admin1 x crop x 2022 mean yield)
Producer prices : producer-prices_zwe.csv (2022 mean price for main crop)

Target (NON-LEAKY):
    A 3-class financial-vulnerability label built from OUTCOME-PROXY variables
    (HHS, p_sev, LCSI, received_food_aid). ALL constituent columns plus
    related food-security / coping / received-aid columns are then REMOVED
    from the feature set, so the model has to learn from socioeconomic,
    agricultural, and environmental predictors only.

Output: data/final_farmer_credit_dataset_with_gee.csv
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
RAW_DIR = Path(r"C:\Users\user\OneDrive\Desktop\final\data")
OLD_GEE = Path(r"C:\Users\user\Downloads\final_farmer_credit_dataset_with_gee (2).csv")
OUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_CSV = OUT_DIR / "final_farmer_credit_dataset_with_gee.csv"

RANDOM_STATE = 42


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def norm_text(x):
    if pd.isna(x):
        return np.nan
    s = unicodedata.normalize("NFKD", str(x)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", " ", s).strip().upper()
    return s or np.nan


def yesno_to_int(s: pd.Series) -> pd.Series:
    """'Yes'->1, 'No'->0, everything else -> NaN."""
    mapping = {
        "Yes": 1, "YES": 1, "yes": 1, 1: 1, "1": 1, True: 1,
        "No": 0, "NO": 0, "no": 0, 0: 0, "0": 0, False: 0,
    }
    return s.map(mapping).astype("float")


def print_section(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


# ---------------------------------------------------------------------------
# 1. Load base dataset
# ---------------------------------------------------------------------------
print_section("1. Load base DIEM farmer survey")
base_path = RAW_DIR / "anon_df (2).csv"
df = pd.read_csv(base_path, low_memory=False)
print(f"Base shape: {df.shape}")

# Keep Zimbabwe only (defensive) and drop rows missing admin info.
df = df[df["adm0_iso3"] == "ZWE"].copy()
df = df.dropna(subset=["adm1_name", "adm2_name"]).reset_index(drop=True)
print(f"After ZWE filter + admin drop-na: {df.shape}")

# Parse survey_date.
df["survey_date"] = pd.to_datetime(df["survey_date"], errors="coerce")
df["survey_year"] = df["survey_date"].dt.year
df["survey_month"] = df["survey_date"].dt.month

# Normalised admin keys for joins.
df["adm1_key"] = df["adm1_name"].map(norm_text)
df["adm2_key"] = df["adm2_name"].map(norm_text)


# ---------------------------------------------------------------------------
# 2. Engineer richer features (before any column dropping)
# ---------------------------------------------------------------------------
print_section("2. Feature engineering")

# --- Shock exposure ---
shock_flags = [c for c in df.columns if c.startswith("shock_")
               and c not in {"shock_noshock", "shock_dk", "shock_ref"}]
# Some shocks are coded as Yes/No strings, some as 0/1 floats.
shock_mat = df[shock_flags].apply(yesno_to_int)
df["shock_count"] = shock_mat.sum(axis=1, min_count=1)

# Category-weighted shock severity (economic, climate, biological, personal).
climate_shocks = [c for c in shock_flags if any(k in c for k in
                  ["drought", "flood", "hurricane", "cold", "hail", "firenatural",
                   "landslides", "earthquake"])]
bio_shocks = [c for c in shock_flags if any(k in c for k in
              ["pest", "plantdisease", "animaldisease"])]
economic_shocks = [c for c in shock_flags if any(k in c for k in
                   ["lostemplor", "higherfood", "higherfuel", "cantwork",
                    "othereconomic"])]
personal_shocks = [c for c in shock_flags if any(k in c for k in
                   ["sickness", "theft", "violence"])]
df["shock_climate_count"]  = shock_mat[climate_shocks].sum(axis=1, min_count=1)
df["shock_bio_count"]      = shock_mat[bio_shocks].sum(axis=1, min_count=1)
df["shock_economic_count"] = shock_mat[economic_shocks].sum(axis=1, min_count=1)
df["shock_personal_count"] = shock_mat[personal_shocks].sum(axis=1, min_count=1)

# --- COVID disruption count ---
covid_flags = [c for c in df.columns if c.startswith("covid_")
               and c not in {"covid_none", "covid_dk", "covid_ref"}]
df["covid_disruption_count"] = df[covid_flags].apply(yesno_to_int).sum(axis=1, min_count=1)

# --- Income diversity (1-3 sources active) ---
inc_amt_cols = ["income_main_amount", "income_sec_amount", "income_third_amount"]
df["income_source_count"] = df[inc_amt_cols].gt(0).sum(axis=1)
df["income_primary_share"] = np.where(
    df["tot_income"] > 0,
    df["income_main_amount"] / df["tot_income"],
    np.nan,
)

# Income quintile WITHIN admin1 (regional wealth positioning).
df["income_quintile_adm1"] = (df.groupby("adm1_name")["tot_income"]
                                .transform(lambda s: pd.qcut(
                                    s.rank(method="first"), 5, labels=False,
                                    duplicates="drop") + 1))

# --- Livestock change ---
df["ls_num_now"] = pd.to_numeric(df["ls_num_now"], errors="coerce")
df["ls_num_lastyr"] = pd.to_numeric(df["ls_num_lastyr"], errors="coerce")
df["ls_num_diff"] = pd.to_numeric(df["ls_num_diff"], errors="coerce")
df["ls_pct_change"] = np.where(
    df["ls_num_lastyr"] > 0,
    (df["ls_num_now"] - df["ls_num_lastyr"]) / df["ls_num_lastyr"],
    np.nan,
)

# --- Crop production-difficulty count ---
cpd_flags = [c for c in df.columns if c.startswith("crp_proddif_")
             and c not in {"crp_proddif_dk", "crp_proddif_ref"}]
df["crp_proddif_count"] = df[cpd_flags].apply(yesno_to_int).sum(axis=1, min_count=1)

csd_flags = [c for c in df.columns if c.startswith("crp_saledif_")
             and c not in {"crp_saledif_dk", "crp_saledif_ref"}]
df["crp_salesdif_count"] = df[csd_flags].apply(yesno_to_int).sum(axis=1, min_count=1)

# --- Needs-expressed count (what the farmer *asked for* — NOT what they received) ---
need_req_flags = [c for c in df.columns if c.startswith("need_")
                  and not c.startswith("need_received_")
                  and c not in {"need_dk", "need_ref", "need"}]
df["needs_expressed_count"] = df[need_req_flags].apply(yesno_to_int).sum(axis=1, min_count=1)


# ---------------------------------------------------------------------------
# 3. Build the NON-LEAKY credit-risk target
# ---------------------------------------------------------------------------
print_section("3. Build target from outcome proxies (non-leaky)")

# Normalise the four standard food-security/coping indicators into [0,1].
hhs     = df["hhs"].clip(lower=0, upper=6).fillna(0)  / 6.0          # Hunger Scale
p_sev   = df["p_sev"].clip(lower=0, upper=1).fillna(0)               # IPC-calibrated severe FI
lcsi    = df["lcsi"].clip(lower=0, upper=3).fillna(0) / 3.0          # Livelihood coping
rec_aid = yesno_to_int(df["need_received_food"]).fillna(0)           # Food aid received

# Weighted composite: emphasises hunger scale + severe FI probability.
df["vulnerability_score"] = (
    0.40 * hhs +
    0.30 * p_sev +
    0.20 * lcsi +
    0.10 * rec_aid
).round(4)

# Threshold bins calibrated against the international indicator literature:
#   HHS>=2  => moderate+ hunger (high risk)
#   p_sev>=0.25 => non-trivial severe FI probability
#   lcsi>=3  => using emergency coping strategies
# A record hits HIGH if any of those trigger; LOW if all are near zero.
def classify(row) -> str:
    if (row["hhs"] >= 2) or (row["p_sev"] >= 0.25) or (row["lcsi"] >= 3) or (rec_aid.loc[row.name] == 1):
        return "HIGH"
    if (row["hhs"] >= 1) or (row["p_sev"] >= 0.05) or (row["lcsi"] >= 2):
        return "MEDIUM"
    return "LOW"

df["credit_risk"] = df.apply(classify, axis=1)
print("credit_risk distribution:")
print(df["credit_risk"].value_counts())
print("vulnerability_score describe:")
print(df["vulnerability_score"].describe().round(4))


# ---------------------------------------------------------------------------
# 4. Merge GEE (admin2 average from the old dataset)
# ---------------------------------------------------------------------------
print_section("4. Merge GEE (CHIRPS + MODIS) via admin2 lookup")

try:
    gee_src = pd.read_csv(OLD_GEE, low_memory=False)
    gee_cols = ["chirps_rain_30d_mm", "chirps_rain_90d_mm",
                "modis_ndvi_90d_mean", "modis_ndvi_90d_std"]
    key_col = "adm2_name_clean" if "adm2_name_clean" in gee_src.columns else "adm2_name"
    gee_src["adm2_key"] = gee_src[key_col].map(norm_text)
    gee_lookup = (gee_src.groupby("adm2_key")[gee_cols].mean().reset_index())
    df = df.merge(gee_lookup, on="adm2_key", how="left")

    # For admin2 names not found, fall back to admin1 average.
    adm1_lookup_src = df.merge(
        gee_src.assign(adm1_key=gee_src.get("adm1_name_clean",
                                            gee_src.get("adm1_name")).map(norm_text)),
        on="adm1_key", how="left", suffixes=("", "_src"))
    for col in gee_cols:
        adm1_fallback = (gee_src
                         .assign(adm1_key=gee_src.get("adm1_name_clean",
                                                      gee_src.get("adm1_name")).map(norm_text))
                         .groupby("adm1_key")[col].mean())
        mask = df[col].isna()
        df.loc[mask, col] = df.loc[mask, "adm1_key"].map(adm1_fallback)

    filled = df[gee_cols].notna().all(axis=1).mean()
    print(f"GEE merged. % rows with all 4 GEE cols non-null: {filled:.1%}")
except FileNotFoundError:
    print(f"[WARN] Old GEE file not found at {OLD_GEE} -- GEE columns will be NaN.")
    for c in ["chirps_rain_30d_mm", "chirps_rain_90d_mm",
              "modis_ndvi_90d_mean", "modis_ndvi_90d_std"]:
        df[c] = np.nan


# ---------------------------------------------------------------------------
# 5. Merge regional crop performance (hvstat)
# ---------------------------------------------------------------------------
print_section("5. Merge regional yield context (hvstat)")

try:
    hv = pd.read_csv(RAW_DIR / "hvstat_africa_data_v1.0.csv", low_memory=False)
    hv = hv[hv["country_code"] == "ZW"].copy()
    # Recent multi-year mean (2018-2022) by admin1 x product.
    hv_recent = hv[(hv["harvest_year"] >= 2018) & (hv["harvest_year"] <= 2022)]
    hv_recent = hv_recent.assign(
        adm1_key=hv_recent["admin_1"].map(norm_text),
        prod_key=hv_recent["product"].map(norm_text),
    )
    hv_agg = (hv_recent.groupby(["adm1_key", "prod_key"])
              [["yield", "production", "area"]]
              .mean().reset_index()
              .rename(columns={"yield": "regional_yield_mean",
                               "production": "regional_prod_mean",
                               "area": "regional_area_mean"}))

    df["prod_key"] = df["crp_main"].map(norm_text)
    df = df.merge(hv_agg, on=["adm1_key", "prod_key"], how="left")

    # Admin1-level fallback across all crops.
    hv_adm1 = (hv_recent.groupby("adm1_key")["yield"]
               .mean().rename("regional_yield_adm1_mean").reset_index())
    df = df.merge(hv_adm1, on="adm1_key", how="left")
    df["regional_yield_mean"] = df["regional_yield_mean"].fillna(df["regional_yield_adm1_mean"])

    df = df.drop(columns=["prod_key"])
    print(f"hvstat merged. % rows with regional_yield_mean: "
          f"{df['regional_yield_mean'].notna().mean():.1%}")
except FileNotFoundError:
    print("[WARN] hvstat file missing -- regional yield set to NaN.")
    df["regional_yield_mean"] = np.nan
    df["regional_prod_mean"]  = np.nan
    df["regional_area_mean"]  = np.nan


# ---------------------------------------------------------------------------
# 6. Macro economic context (national, year-level)
# ---------------------------------------------------------------------------
print_section("6. Macro economic context (CPI inflation)")
# DIEM records crp_main as internal numeric product codes which don't align
# cleanly with FAOSTAT item names, so instead of a fragile crop-level
# producer-price join we attach a single, robust national macro signal:
# headline CPI for the survey year from consumer-price-indices_zwe.csv.
try:
    cpi_path = RAW_DIR / "consumer-price-indices_zwe.csv"
    cpi = pd.read_csv(cpi_path, low_memory=False)
    cpi_total = cpi[cpi["Item"].astype(str).str.strip()
                    .str.lower().eq("consumer prices, general indices (2015 = 100)")]
    if cpi_total.empty:
        cpi_total = cpi  # fallback
    cpi_year = (cpi_total.groupby("Year")["Value"].mean()
                .rename("cpi_general_index").reset_index())
    df = df.merge(cpi_year, left_on="survey_year", right_on="Year", how="left")
    df = df.drop(columns=[c for c in ["Year"] if c in df.columns])
    print(f"CPI merged. % rows with cpi_general_index: "
          f"{df['cpi_general_index'].notna().mean():.1%}")
except FileNotFoundError:
    print("[WARN] CPI file missing -- cpi_general_index set to NaN.")
    df["cpi_general_index"] = np.nan


# ---------------------------------------------------------------------------
# 7. Drop leakage / noise / identifier columns
# ---------------------------------------------------------------------------
print_section("7. Drop leakage / noise columns")

# Leakage — all the outcome-proxy columns that were used to build the target,
# plus all related food-security / coping / received-aid indicators.
LEAKAGE_COLS = (
    # Source of the target
    ["hhs", "hhg", "p_mod", "p_sev", "p_ipc3plus", "p_ipc4plus", "p_ipc5",
     "lcsi", "hdds_score", "hdds_class", "fcs", "fcg"]
    # FIES items
    + [c for c in df.columns if c.startswith("fies_")]
    + [c for c in df.columns if c.startswith("hdds_")]
    + [c for c in df.columns if c.startswith("fcs_")]
    + [c for c in df.columns if c.startswith("rcsi_")]
    + [c for c in df.columns if c.startswith("cs_stress_")
                              or c.startswith("cs_crisis_")
                              or c.startswith("cs_emergency_")]
    + [c for c in df.columns if c.startswith("need_received_")]
)

# Administrative noise / identifiers / survey metadata.
NOISE_COLS = [
    "objectid", "survey_id", "operator_id", "total_case_duration",
    "callback", "language", "weight_final",
    "adm_level", "adm0_name", "adm0_iso3", "adm1_pcode", "adm2_pcode",
    "adm1_key", "adm2_key",
    "regional_yield_adm1_mean",  # helper intermediate
]

# DIEM has many "don't know / refused / other" binary flags that are near-empty
# in this Zimbabwe sample and would add no signal; also fish_* is irrelevant
# for Zimbabwe smallholders. Drop them.
BOILERPLATE_NOISE = (
    [c for c in df.columns if c.endswith("_dk") or c.endswith("_ref")
                            or c.endswith("_other") or c == "shock_dk"
                            or c == "shock_ref"]
    + [c for c in df.columns if c.startswith("fish_")]
)
NOISE_COLS.extend(BOILERPLATE_NOISE)

# Keep a small administrative footprint for grouping / display only.
KEEP_FOR_CONTEXT = ["adm1_name", "adm2_name", "survey_date",
                    "survey_year", "survey_month", "round"]

drop_cols = [c for c in (LEAKAGE_COLS + NOISE_COLS) if c in df.columns]
df = df.drop(columns=list(set(drop_cols)))
print(f"Dropped {len(set(drop_cols))} leakage/noise columns.")

# Remove near-constant cols that add no signal.
nunique = df.nunique(dropna=False)
near_const = nunique[nunique <= 1].index.tolist()
if near_const:
    df = df.drop(columns=near_const)
    print(f"Dropped {len(near_const)} near-constant columns: {near_const[:6]}...")


# ---------------------------------------------------------------------------
# 8. Reorder: identifiers -> features -> target
# ---------------------------------------------------------------------------
print_section("8. Reorder columns")

context_cols = [c for c in KEEP_FOR_CONTEXT if c in df.columns]
target_cols  = ["vulnerability_score", "credit_risk"]
feature_cols = [c for c in df.columns if c not in context_cols + target_cols]
df = df[context_cols + feature_cols + target_cols]
print(f"Final shape: {df.shape}")
print(f"  Context cols : {len(context_cols)}")
print(f"  Feature cols : {len(feature_cols)}")
print(f"  Target cols  : {len(target_cols)}")


# ---------------------------------------------------------------------------
# 9. Leakage audit — train a quick model and show the top-signal features.
#     If any single feature perfectly predicts the target, that's leakage.
# ---------------------------------------------------------------------------
print_section("9. Leakage audit")
from sklearn.feature_selection import mutual_info_classif
from sklearn.preprocessing import LabelEncoder

audit_X = df[feature_cols].copy()
# Encode categoricals / strings with simple label encoding for the audit.
for c in audit_X.columns:
    if audit_X[c].dtype == object:
        audit_X[c] = LabelEncoder().fit_transform(audit_X[c].astype(str))
    audit_X[c] = pd.to_numeric(audit_X[c], errors="coerce")
audit_X = audit_X.fillna(audit_X.median(numeric_only=True)).fillna(0)

mi = mutual_info_classif(
    audit_X, df["credit_risk"],
    discrete_features=False, random_state=RANDOM_STATE,
)
mi_df = (pd.DataFrame({"feature": feature_cols, "mi_vs_target": mi})
         .sort_values("mi_vs_target", ascending=False).reset_index(drop=True))
print("Top 15 features by mutual information with credit_risk:")
print(mi_df.head(15).to_string(index=False))
print(f"\nMax MI: {mi_df['mi_vs_target'].max():.4f}   "
      f"(anything near log2(3)=1.585 would indicate leakage)")

mi_out = OUT_DIR / "feature_mutual_information_audit.csv"
mi_df.to_csv(mi_out, index=False)
print(f"Audit saved to {mi_out}")


# ---------------------------------------------------------------------------
# 10. Save
# ---------------------------------------------------------------------------
print_section("10. Save")
df.to_csv(OUT_CSV, index=False)
print(f"Wrote: {OUT_CSV}   ({OUT_CSV.stat().st_size / 1024:,.1f} KB)")
print("\nFinal credit_risk distribution:")
print(df["credit_risk"].value_counts())
print("\nAdmin1 distribution:")
print(df["adm1_name"].value_counts())

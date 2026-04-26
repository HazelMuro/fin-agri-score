"""
Explainability: SHAP TreeExplainer on the final tree-based estimator in the
saved sklearn Pipeline (XGBoost, CatBoost, LightGBM, etc., depending on the
Objective 1 artifact), with a fallback to `feature_importances_` when needed.

Training column names are mapped to plain-English labels for the dashboard.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

try:
    import shap  
    _SHAP_AVAILABLE = True
except Exception:  
    _SHAP_AVAILABLE = False


FRIENDLY_LABELS: Dict[str, str] = {
    "round": "Survey round",
    "adm1_name": "Province",
    "adm2_name": "District",
    "adm1_name_clean": "Province (cleaned)",
    "adm2_name_clean": "District (cleaned)",
    "adm2_name_match": "District match flag",
    "weight_final": "Survey weight",
    "hh_gender": "Household head gender",
    "hh_education": "Head of household education level",
    "hh_wealth_light": "Household wealth (lighting proxy)",
    "hh_agricactivity": "Household agricultural activity level",
    "income_main_amount": "Main income amount",
    "income_main_comp": "Main income source",
    "income_sec_amount": "Secondary income amount",
    "income_sec_comp": "Secondary income source",
    "income_third_amount": "Third income amount",
    "income_third_comp": "Third income source",
    "income_main_log": "Main income (log-scaled)",
    "income_sec_log": "Secondary income (log-scaled)",
    "has_sec_income": "Has a secondary income",
    "has_third_income": "Has a third income",
    "income_diversity": "Income diversification",
    "crp_main": "Main crop",
    "crp_area_change": "Crop area change vs last season",
    "crp_proddif": "Crop production difficulty",
    "crp_salesdif": "Crop sales difficulty",
    "crp_salesprice": "Crop sales price",
    "ls_main": "Main livestock",
    "ls_proddif": "Livestock production difficulty",
    "ls_salesdif": "Livestock sales difficulty",
    "ls_salesprice": "Livestock sales price",
    "shock_noshock": "Recent economic / climate shock",
    "hdds_score": "Household dietary diversity score",
    "hdds_class": "Household dietary diversity class",
    "lcsi": "Livelihood coping strategy index",
    "need": "Reported household need",
    "need_received_food": "Received food assistance",
    "need_received_other": "Received other assistance",
    "chirps_rain_30d_mm": "Rainfall, last 30 days (mm)",
    "chirps_rain_90d_mm": "Rainfall, last 90 days (mm)",
    "modis_ndvi_90d_mean": "Vegetation health (NDVI 90d mean)",
    "modis_ndvi_90d_std": "Vegetation variability (NDVI 90d std)",
    "environment_score": "Environmental score",
    "environment_risk": "Environmental risk",
    "survey_year": "Survey year",
    "survey_month": "Survey month",
    "ndvi_rain_ratio": "NDVI / rainfall ratio",
    "rain_diff_30_90": "Rainfall trend (30d vs 90d)",
    "ndvi_volatility": "Vegetation volatility",
    "hdds_env_composite": "Food security × environment composite",
    "rain_ndvi_interact": "Rain × NDVI interaction",
}


def friendly_label(feature: str) -> str:
    return FRIENDLY_LABELS.get(feature, feature.replace("_", " ").capitalize())


def _extract_booster(pipeline: Any) -> Optional[Any]:
    """Return the XGBClassifier's underlying booster or None if not reachable."""
    try:
        final_est = pipeline.steps[-1][1]
    except Exception:
        final_est = pipeline
    if hasattr(final_est, "get_booster"):
        return final_est
    return None


def _transform_through_pipeline_except_last(pipeline: Any, X: pd.DataFrame) -> Any:
    """Run preprocessing steps (all but the final estimator) to get the model-ready matrix."""
    try:
        if len(pipeline.steps) == 1:
            return X
        pre = pipeline[:-1]
        return pre.transform(X)
    except Exception:
        return X


def top_factors(
    pipeline: Any,
    X_row: pd.DataFrame,
    feature_columns: List[str],
    raw_values: Dict[str, Any],
    low_class_index: int,
    top_k: int = 6,
) -> List[Dict[str, Any]]:
    """Compute top contributing features for a single prediction.

    Uses SHAP TreeExplainer on the XGBoost booster when available.
    Falls back to model feature_importances_ when SHAP fails.
    """
    booster = _extract_booster(pipeline)

    if _SHAP_AVAILABLE and booster is not None:
        try:
            X_transformed = _transform_through_pipeline_except_last(pipeline, X_row)
            explainer = shap.TreeExplainer(booster)
            shap_values = explainer.shap_values(X_transformed)

            if isinstance(shap_values, list):
                vals = np.array(shap_values[low_class_index][0])
            else:
                arr = np.array(shap_values)
                if arr.ndim == 3:
                    vals = arr[0, :, low_class_index]
                elif arr.ndim == 2:
                    vals = arr[0]
                else:
                    vals = arr

            try:
                post_feature_names = list(
                    pipeline[:-1].get_feature_names_out()
                )
            except Exception:
                post_feature_names = feature_columns

            pairs = list(zip(post_feature_names, vals))
            pairs.sort(key=lambda t: abs(float(t[1])), reverse=True)
            pairs = pairs[:top_k]

            result = []
            for name, val in pairs:
                base_name = _strip_transformer_prefix(name)
                raw_val = raw_values.get(base_name, None)
                impact = float(val)
                direction = "reduces_risk" if impact > 0 else "increases_risk"
                result.append({
                    "feature": base_name,
                    "label": friendly_label(base_name),
                    "value": raw_val,
                    "impact": round(impact, 5),
                    "direction": direction,
                })
            return result
        except Exception:
            pass

    try:
        est = pipeline.steps[-1][1] if hasattr(pipeline, "steps") else pipeline
        importances = getattr(est, "feature_importances_", None)
        if importances is not None:
            names = list(feature_columns)
            if len(importances) != len(names):
                try:
                    names = list(pipeline[:-1].get_feature_names_out())
                except Exception:
                    names = [f"f{i}" for i in range(len(importances))]
            pairs = list(zip(names, importances))
            pairs.sort(key=lambda t: float(t[1]), reverse=True)
            pairs = pairs[:top_k]
            return [
                {
                    "feature": _strip_transformer_prefix(n),
                    "label": friendly_label(_strip_transformer_prefix(n)),
                    "value": raw_values.get(_strip_transformer_prefix(n), None),
                    "impact": round(float(v), 5),
                    "direction": "neutral",
                }
                for n, v in pairs
            ]
    except Exception:
        pass

    return []


def _strip_transformer_prefix(name: str) -> str:
    """ColumnTransformer may emit names like 'num__feature' or 'cat__feature'. Strip that."""
    for sep in ("__",):
        if sep in name:
            return name.split(sep, 1)[1]
    return name

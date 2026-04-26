"""Request / response Pydantic schemas for the inference microservice."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# Swagger / OpenAPI "Example value" — mirrors a typical Ob2 dashboard scoring row.
# `crp_main` is numeric in training; free-text crop labels from the UI must not be sent here.
EXAMPLE_PREDICT_FEATURES: Dict[str, Any] = {
    "resp_age": 42,
    "resp_gender": "Female",
    "hh_agricactivity": "Yes - crop production only",
    "hh_gender": "Female",
    "hh_education": "Secondary",
    "hh_size": 5,
    "hh_maritalstat": "Married",
    "income_main": "Crop farming",
    "income_main_amount": 420,
    "income_main_comp": "Crop farming",
    "income_sec": "Casual labour",
    "income_sec_amount": 90,
    "income_sec_comp": "Casual labour",
    "tot_income": 510,
    "income_source_count": 2,
    "income_primary_share": 0.824,
    "crp_main": 1500,
    "crp_landsize": "0.5-2ha",
    "crp_irrigation": "No",
    "need_loans": "Yes",
    "need_seeds": "Yes",
    "shock_noshock": 1,
    "shock_count": 0,
    "shock_economic_count": 0,
    "chirps_rain_30d_mm": 45.2,
    "chirps_rain_90d_mm": 312.0,
    "modis_ndvi_90d_mean": 0.42,
    "modis_ndvi_90d_std": 0.08,
}

EXAMPLE_PREDICT_REQUEST: Dict[str, Any] = {
    "features": EXAMPLE_PREDICT_FEATURES,
    "application_id": "cmo9001demo00000000000001",
}


class PredictRequest(BaseModel):
    """A flexible payload: the Node backend sends a dict of feature_name -> value.

    Missing features are left as null/NaN and handled by the trained pipeline's
    imputers. Extra keys are ignored. Order does not matter — we re-order into
    training order.
    """

    model_config = ConfigDict(json_schema_extra={"example": EXAMPLE_PREDICT_REQUEST})

    features: Dict[str, Any] = Field(
        ...,
        description=(
            "Flat map of feature_name -> value (same keys as training / "
            "`artifacts/output/feature_columns.json`). The Node feature builder maps "
            "UI crop labels to numeric `crp_main` via `crop_main_codes.json` before calling "
            "this service; raw requests should send a numeric `crp_main` or null."
        ),
    )
    application_id: Optional[str] = Field(None, description="Optional correlation id for logs")


class TopFactor(BaseModel):
    feature: str
    label: str                           
    value: Any                           
    impact: float                        
    direction: str                       


class PredictResponse(BaseModel):
    predicted_label: str
    class_probabilities: Dict[str, float]
    p_low_risk: float = Field(
        ...,
        description=(
            "Probability mass for the LOW credit-risk class from the model (not a literal "
            "loan repayment rate). Same role as the former `repayment_probability` field."
        ),
    )
    fin_agri_score: int
    risk_band: str
    recommendation: str
    top_factors: List[TopFactor]
    model_name: str
    model_version: str
    threshold_used: float
    imputed_features: List[str] = Field(default_factory=list)
    feature_coverage: float = 0.0

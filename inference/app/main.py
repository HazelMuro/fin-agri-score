"""
Fin-Agri Score — Python Inference Microservice
===============================================

Internal-only HTTP service that loads the Objective-1 trained model and serves
/predict to the Node backend. It is NOT intended to be exposed to end users.

Start it with:

    uvicorn app.main:app --host 0.0.0.0 --port 8000

Endpoints:
    GET  /health       — liveness + model metadata
    POST /predict      — run a scoring request
"""

from __future__ import annotations

import os
from typing import Any, Dict

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .explain import top_factors
from .model_loader import LoadedModel, load_model
from .schemas import PredictRequest, PredictResponse, TopFactor
from .scoring import (
    compute_fin_agri_score,
    compute_recommendation,
    compute_risk_band,
    decide_predicted_label,
)


load_dotenv()

app = FastAPI(
    title="Fin-Agri Score — Inference Microservice",
    description=(
        "Internal service that loads the Objective 1 sklearn `Pipeline` from MODEL_DIR "
        "(see `model_metadata.json` → `selected_model`; actual class may be CatBoost, XGBoost, etc.) "
        "and exposes POST /predict. Model name and label order are also returned by GET /health. "
        "For application-level scoring (readiness, persistence), use the Node.js API."
    ),
    version="1.0.0",
)

_cors = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:4000,http://127.0.0.1:4000,http://localhost:5173,http://127.0.0.1:5173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    load_model()


@app.get("/health")
def health() -> Dict[str, Any]:
    try:
        m = load_model()
        return {
            "status": "ok",
            "model_type": m.metadata.get("selected_model", m.metadata.get("model_type")),
            "n_features": m.metadata.get("n_features"),
            "label_classes": m.label_classes,
            "low_class_threshold": m.low_class_threshold,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"model not ready: {e}")


def _build_feature_row(
    features_in: Dict[str, Any],
    feature_columns: list,
):
    """Build a 1-row DataFrame in the exact training column order.

    Keys missing from the HTTP payload are counted as `imputed_features` for
    transparency (how complete the request was). The sklearn pipeline may still
    impute additional columns internally from NaN — that is separate.
    """
    raw: Dict[str, Any] = {}
    imputed: list = []
    for col in feature_columns:
        val = features_in.get(col, None)
        if val is None or val == "":
            raw[col] = None
            imputed.append(col)
        else:
            raw[col] = val

    row: Dict[str, Any] = {
        col: (np.nan if v is None else v) for col, v in raw.items()
    }

    df = pd.DataFrame([row], columns=feature_columns)
    return df, raw, imputed


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    model: LoadedModel = load_model()

    try:
        X, raw_values, imputed_features = _build_feature_row(req.features, model.feature_columns)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid features payload: {e}")

    try:
        proba = model.pipeline.predict_proba(X)[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {e}")

    classes = list(model.label_encoder.classes_)
    raw_probs = {str(cls): float(p) for cls, p in zip(classes, proba)}

    blend_applied = False
    class_probabilities = raw_probs
    if req.previous_class_probabilities is not None and req.minor_blend_alpha is not None:
        alpha = float(req.minor_blend_alpha)
        alpha = max(0.0, min(1.0, alpha))
        if alpha > 0.0:
            blended: Dict[str, float] = {}
            for cls in classes:
                key = str(cls)
                prev_p = float(req.previous_class_probabilities.get(key, 0.0))
                blended[key] = alpha * prev_p + (1.0 - alpha) * raw_probs[key]
            total = sum(blended.values())
            if total > 0.0:
                class_probabilities = {k: v / total for k, v in blended.items()}
            blend_applied = True

    predicted_label, p_low = decide_predicted_label(
        class_probabilities, model.low_class_threshold
    )

    fin_agri_score = compute_fin_agri_score(
        predicted_label, class_probabilities, model.low_class_threshold
    )
    risk_band = compute_risk_band(fin_agri_score)
    recommendation = compute_recommendation(risk_band)

    factors_raw = top_factors(
        pipeline=model.pipeline,
        X_row=X,
        feature_columns=model.feature_columns,
        raw_values=raw_values,
        low_class_index=model.low_class_index,
        top_k=6,
    )
    factors = [TopFactor(**f) for f in factors_raw]

    total = max(1, len(model.feature_columns))
    imputed_ratio = round(len(imputed_features) / total, 3)
    feature_coverage = round(1.0 - imputed_ratio, 3)

    model_name = str(
        model.metadata.get("selected_model", model.metadata.get("model_type", "sklearn_pipeline"))
    )
    m = model.metadata.get("final_test_metrics", {}) or {}
    f1m = m.get("f1_macro", model.metadata.get("f1_macro", 0))
    model_version = f"f1_macro={round(float(f1m), 3)}_n_train={model.metadata.get('n_rows_train', '?')}"

    return PredictResponse(
        predicted_label=predicted_label,
        class_probabilities=class_probabilities,
        p_low_risk=round(float(p_low), 4),
        fin_agri_score=fin_agri_score,
        risk_band=risk_band,
        recommendation=recommendation,
        top_factors=factors,
        model_name=model_name,
        model_version=model_version,
        threshold_used=model.low_class_threshold,
        imputed_features=imputed_features,
        feature_coverage=feature_coverage,
        probability_blend_applied=blend_applied,
    )


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("INFERENCE_HOST", "0.0.0.0")
    port = int(os.environ.get("INFERENCE_PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)

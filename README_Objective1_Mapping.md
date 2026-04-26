# Objective 1 Mapping — Trained ML Model

## What Objective 1 produced

A trained XGBoost classifier for smallholder-farmer credit risk, along with three supporting artifacts:

| File | Purpose |
|---|---|
| `final_farmer_credit_model.joblib` | The sklearn `Pipeline` (preprocessing + XGBClassifier) |
| `final_farmer_credit_label_encoder.joblib` | Decoder for class labels (`HIGH`, `LOW`, `MEDIUM`) |
| `feature_columns.json` | The ordered list of 51 input features used at training |
| `model_metadata.json` | Best params, CV scores, `low_class_threshold = 0.19`, label order |

From `model_metadata.json`:

- Model: `XGBClassifier` — `n_estimators=200`, `max_depth=4`, `learning_rate=0.05`, `colsample_bytree=0.85`, `subsample=0.85`
- Test weighted-F1 ≈ **0.625**, accuracy ≈ **0.627** (on 268 test samples)
- Classes: `HIGH`, `LOW`, `MEDIUM` — where `LOW` = low default risk (good repayer)
- Decision rule: predict `LOW` when `P(LOW) >= 0.19`, otherwise `argmax`

## Where Objective 1 appears in the final product

- **Artifacts location**: `C:/Users/user/OneDrive/Desktop/hazel/data/` (unchanged — the inference service reads them from there via the `MODEL_DIR` environment variable).
- **Runtime wrapper**: the Python `inference/` microservice loads the four artifacts once at startup and exposes a single `/predict` endpoint.
- **Never retrained**: the project contains zero training code. Objective 1 is strictly consumed, not rebuilt.

```
 /data/*.joblib  ──────▶  inference/app/model_loader.py  ──▶  inference/app/main.py  (FastAPI)
                                                                         │
                                                          HTTP /predict  ▼
                                                    backend/src/services/inferenceClient.js
```

## How /predict is served

1. `model_loader.load_model()` — reads artifacts from `MODEL_DIR` and caches them in-process.
2. Client POSTs `{ "features": { ... } }` where keys are column names from `feature_columns.json`.
3. `main.py` builds a single-row `pandas.DataFrame` in the exact training order; missing features are left as `NaN` and the saved Pipeline handles the preprocessing exactly as at training time.
4. `pipeline.predict_proba(X)` → raw class probabilities.
5. `scoring.decide_predicted_label()` applies the `LOW`-class threshold from `model_metadata.json`.
6. `scoring.compute_fin_agri_score()` converts `P(LOW)` into a familiar **300–850** bank-style score:
   `round(300 + 550 * P(LOW))`.
7. `scoring.compute_risk_band()` bands the score: Low ≥ 700, Medium ≥ 550, High < 550.
8. `explain.top_factors()` runs SHAP's `TreeExplainer` on the booster and returns the 6 most influential features, translated into plain-English labels via `FRIENDLY_LABELS`.

## Example request / response

Request:

```json
POST /predict
{
  "features": {
    "adm1_name": "Mashonaland East",
    "adm2_name": "Murehwa",
    "hh_gender": 1,
    "income_main_amount": 520,
    "crp_main": "Maize",
    "chirps_rain_90d_mm": 235,
    "modis_ndvi_90d_mean": 0.58,
    "environment_score": 72
  }
}
```

Response:

```json
{
  "predicted_label": "LOW",
  "class_probabilities": { "HIGH": 0.18, "LOW": 0.54, "MEDIUM": 0.28 },
  "repayment_probability": 0.54,
  "fin_agri_score": 597,
  "risk_band": "Medium",
  "recommendation": "Approve with risk mitigants — consider a guarantor...",
  "top_factors": [
    { "feature": "chirps_rain_90d_mm", "label": "Rainfall, last 90 days (mm)", "value": 235, "impact": 0.41, "direction": "reduces_risk" }
  ],
  "model_name": "XGBClassifier",
  "model_version": "trainN=1068_f1=0.625",
  "threshold_used": 0.19
}
```

## Presentation soundbite

> "Objective 1 produced the trained XGBoost model and three supporting files. In the final product those files sit inside `/data` and are served by a lightweight Python inference microservice. We never retrain them — we use them for inference only."

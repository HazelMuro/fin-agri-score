# Model artifacts (Objective 1)

Place the four **Objective 1** training outputs in `output/` (or set `MODEL_DIR` to that folder when starting the Python inference service):

- `final_farmer_credit_model.joblib`
- `final_farmer_credit_label_encoder.joblib`
- `feature_columns.json` (object with `all_features` array, or a plain string array)
- `model_metadata.json`
- `crop_main_codes.json` (optional but recommended) — maps dashboard crop **labels** (e.g. `"Maize"`) to the **numeric** `crp_main` values used in training. Read by **`backend/src/services/featureBuilder.js`** when building the feature vector for `/predict`. The Python service still receives numeric `crp_main` only.

Optional files for dashboards: `feature_importance.csv`, `top_features.json`, `sample_shap_explanations.json`, `model_comparison.csv`, `confusion_matrix.png`.

The Node.js backend reads `feature_columns.json` and `crop_main_codes.json` for scoring feature assembly; the **Python** `inference/` service loads the `joblib` pipeline and `model_metadata.json` for scoring.

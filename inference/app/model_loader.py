"""
Loads the trained Objective 1 artifacts from MODEL_DIR exactly once on startup.

The artifacts expected in MODEL_DIR are:
    - final_farmer_credit_model.joblib
    - final_farmer_credit_label_encoder.joblib
    - feature_columns.json
    - model_metadata.json

The saved object is a scikit-learn Pipeline (preprocess + classifier). The
final estimator may be XGBoost, CatBoost, etc., per `model_metadata.json` →
`selected_model`. The whole pipeline is loaded intact so preprocessing matches
training exactly.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List

import joblib


@dataclass
class LoadedModel:
    pipeline: Any                     
    label_encoder: Any                
    feature_columns: List[str]        
    metadata: dict                    
    low_class_threshold: float
    low_class_index: int
    label_classes: List[str]


_MODEL: LoadedModel | None = None


def _resolve_model_dir() -> Path:
    raw = os.environ.get("MODEL_DIR")
    if not raw:
        raise RuntimeError(
            "MODEL_DIR environment variable is not set. "
            "Point it at the folder containing the joblib artifacts."
        )
    path = Path(raw).expanduser().resolve()
    if not path.exists():
        raise RuntimeError(f"MODEL_DIR does not exist: {path}")
    return path


def load_model() -> LoadedModel:
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    model_dir = _resolve_model_dir()

    pipeline = joblib.load(model_dir / "final_farmer_credit_model.joblib")
    label_encoder = joblib.load(model_dir / "final_farmer_credit_label_encoder.joblib")

    with open(model_dir / "feature_columns.json", "r", encoding="utf-8") as f:
        fc_raw = json.load(f)
    if isinstance(fc_raw, list):
        feature_columns = fc_raw
    elif isinstance(fc_raw, dict) and "all_features" in fc_raw:
        feature_columns = list(fc_raw["all_features"])
    else:
        raise ValueError("feature_columns.json must be a list or contain all_features[]")

    with open(model_dir / "model_metadata.json", "r", encoding="utf-8") as f:
        metadata = json.load(f)

    env_threshold = os.environ.get("LOW_CLASS_THRESHOLD")
    default_thr = 0.19
    if env_threshold:
        low_threshold = float(env_threshold)
    else:
        low_threshold = float(metadata.get("low_class_threshold", default_thr))

    # Encoder order: [HIGH, LOW, MEDIUM] in your Colab run → index of "LOW" is 1
    enc_classes = list(label_encoder.classes_)
    if "low_class_index" in metadata:
        low_class_index = int(metadata["low_class_index"])
    else:
        try:
            low_class_index = enc_classes.index("LOW")
        except ValueError:
            low_class_index = 1
    label_classes = list(metadata.get("class_labels", metadata.get("label_classes", enc_classes)))

    _MODEL = LoadedModel(
        pipeline=pipeline,
        label_encoder=label_encoder,
        feature_columns=feature_columns,
        metadata=metadata,
        low_class_threshold=low_threshold,
        low_class_index=low_class_index,
        label_classes=label_classes,
    )
    return _MODEL


def get_model() -> LoadedModel:
    if _MODEL is None:
        return load_model()
    return _MODEL

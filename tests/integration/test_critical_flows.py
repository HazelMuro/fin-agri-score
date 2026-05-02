"""
Integration tests for critical flows (SS 6.4).
Tests the Fin-Agri Score inference service endpoints and functionality.
"""
import os
import sys

# Hardcoded paths - use the fin-agri-score project folder as base
FIN_AGRI_BASE = r"c:\Users\user\OneDrive\Desktop\hazel\fin-agri-score"
INFERENCE_APP_PATH = os.path.join(FIN_AGRI_BASE, "inference", "app")
ARTIFACTS_PATH = os.path.join(FIN_AGRI_BASE, "artifacts", "output")

# Add paths in the correct order
sys.path.insert(0, INFERENCE_APP_PATH)
sys.path.insert(0, os.path.join(FIN_AGRI_BASE, "inference"))

# Set the MODEL_DIR environment variable
os.environ['MODEL_DIR'] = ARTIFACTS_PATH

import pytest
import json


def test_model_metadata_exists():
    """Test that model metadata file exists and can be loaded."""
    metadata_path = os.path.join(ARTIFACTS_PATH, 'model_metadata.json')
    assert os.path.exists(metadata_path), "model_metadata.json should exist"
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    assert 'class_labels' in metadata
    assert 'LOW' in metadata['class_labels']


def test_feature_columns_exists():
    """Test that feature columns file exists and is properly formatted."""
    features_path = os.path.join(ARTIFACTS_PATH, 'feature_columns.json')
    assert os.path.exists(features_path), "feature_columns.json should exist"
    with open(features_path, 'r') as f:
        features = json.load(f)
    # Can be either a list or a dict with 'all_features' key
    if isinstance(features, dict):
        assert 'all_features' in features
        assert len(features['all_features']) > 0
    else:
        assert len(features) > 0


def test_label_encoder_exists():
    """Test that label encoder file exists."""
    encoder_path = os.path.join(ARTIFACTS_PATH, 'final_farmer_credit_label_encoder.joblib')
    assert os.path.exists(encoder_path), "label encoder should exist"


def test_model_file_exists():
    """Test that model file exists."""
    model_path = os.path.join(ARTIFACTS_PATH, 'final_farmer_credit_model.joblib')
    assert os.path.exists(model_path), "model file should exist"


def test_schemas():
    """Test that API schemas are properly defined."""
    from schemas import PredictRequest, PredictResponse
    
    # Test PredictRequest schema
    request = PredictRequest(features={"feature1": 1.0, "feature2": 2.0})
    assert hasattr(request, 'features')
    
    # Test that PredictResponse exists
    assert PredictResponse is not None


def test_scoring_module():
    """Test that scoring module imports correctly."""
    import scoring
    assert hasattr(scoring, 'compute_fin_agri_score')
    assert hasattr(scoring, 'compute_risk_band')
    assert hasattr(scoring, 'compute_recommendation')


def test_decide_predicted_label():
    """Test the label decision function."""
    from scoring import decide_predicted_label
    
    # Test with different probability distributions
    probs_low = {"LOW": 0.5, "MEDIUM": 0.3, "HIGH": 0.2}
    label, p_low = decide_predicted_label(probs_low, 0.19)
    assert label in ["LOW", "MEDIUM", "HIGH"]
    
    # Test with LOW below threshold
    probs_low_below = {"LOW": 0.1, "MEDIUM": 0.5, "HIGH": 0.4}
    label, p_low = decide_predicted_label(probs_low_below, 0.19)
    assert label in ["MEDIUM", "HIGH"]


def test_compute_fin_agri_score():
    """Test Fin-Agri Score calculation."""
    from scoring import compute_fin_agri_score
    
    # Test score calculation for different labels
    score_low = compute_fin_agri_score("LOW", {"LOW": 0.5, "MEDIUM": 0.3, "HIGH": 0.2}, 0.19)
    assert 700 <= score_low <= 850
    
    score_med = compute_fin_agri_score("MEDIUM", {"LOW": 0.3, "MEDIUM": 0.5, "HIGH": 0.2}, 0.19)
    assert 550 <= score_med <= 699
    
    score_high = compute_fin_agri_score("HIGH", {"LOW": 0.2, "MEDIUM": 0.3, "HIGH": 0.5}, 0.19)
    assert 300 <= score_high <= 549


def test_compute_risk_band():
    """Test risk band calculation from score."""
    from scoring import compute_risk_band
    
    # Test different score ranges
    assert compute_risk_band(900) == "Low"
    assert compute_risk_band(750) == "Low"
    assert compute_risk_band(700) == "Low"
    assert compute_risk_band(650) == "Medium"
    assert compute_risk_band(600) == "Medium"
    assert compute_risk_band(550) == "Medium"
    assert compute_risk_band(500) == "High"
    assert compute_risk_band(400) == "High"
    assert compute_risk_band(300) == "High"


def test_compute_recommendation():
    """Test recommendation text generation."""
    from scoring import compute_recommendation
    
    # Test different risk bands
    rec_low = compute_recommendation("Low")
    assert len(rec_low) > 0
    
    rec_med = compute_recommendation("Medium")
    assert len(rec_med) > 0
    
    rec_high = compute_recommendation("High")
    assert len(rec_high) > 0


def test_explain_module():
    """Test that explain module loads correctly."""
    import explain
    assert explain is not None
    assert hasattr(explain, 'friendly_label')
    assert hasattr(explain, 'top_factors')


def test_friendly_labels():
    """Test friendly label mapping."""
    from explain import friendly_label
    
    # Test known labels
    assert friendly_label("chirps_rain_90d_mm") == "Rainfall, last 90 days (mm)"
    assert friendly_label("modis_ndvi_90d_mean") == "Vegetation health (NDVI 90d mean)"

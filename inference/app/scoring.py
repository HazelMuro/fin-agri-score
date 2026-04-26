"""
Business logic that turns raw model probabilities into the user-facing
Fin-Agri Score, risk band, and lending recommendation.

Design
------
The model is a 3-class classifier (HIGH / MEDIUM / LOW risk) trained on a
food-security / livelihoods survey where the LOW class is the minority.
`model_metadata.json` carries a calibrated `low_class_threshold` (~0.19)
above which the decision rule declares the farmer LOW risk.

The earlier mapping used `score = 300 + 550 * P(LOW)`, which is mathematically
inconsistent with the label rule: a farmer could be decided LOW by the model
(P(LOW) = 0.22 > threshold) but scored 421 — firmly in the HIGH band.

This module anchors the Fin-Agri Score to the *decided label* first, then uses
the within-class probability for fine-grained positioning inside that band:

    predicted_label == "LOW"    -> score in [700, 850]
    predicted_label == "MEDIUM" -> score in [550, 699]
    predicted_label == "HIGH"   -> score in [300, 549]

This guarantees that the displayed score and the model's class decision always
agree, and produces a realistic spread across the risk spectrum instead of
collapsing almost everyone into HIGH.
"""

from __future__ import annotations

import os
from typing import Dict, Tuple


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


FIN_AGRI_SCORE_MIN = _int_env("FIN_AGRI_SCORE_MIN", 300)
FIN_AGRI_SCORE_MAX = _int_env("FIN_AGRI_SCORE_MAX", 850)
RISK_BAND_LOW_MIN = _int_env("RISK_BAND_LOW_MIN", 700)
RISK_BAND_MEDIUM_MIN = _int_env("RISK_BAND_MEDIUM_MIN", 550)


def _clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(x)))


def compute_fin_agri_score(
    predicted_label: str,
    class_probabilities: Dict[str, float],
    low_threshold: float,
) -> int:
    """Label-anchored Fin-Agri Score.

    Parameters
    ----------
    predicted_label : "LOW" | "MEDIUM" | "HIGH"
        The decided class (from `decide_predicted_label`).
    class_probabilities : dict
        Raw model probabilities keyed by class name.
    low_threshold : float
        Calibrated LOW-class threshold from model_metadata.json.
    """
    p_low = _clip(class_probabilities.get("LOW", 0.0))
    p_med = _clip(class_probabilities.get("MEDIUM", 0.0))
    p_high = _clip(class_probabilities.get("HIGH", 0.0))

    if predicted_label == "LOW":
        denom = max(1e-6, 1.0 - low_threshold)
        scaled = _clip((p_low - low_threshold) / denom)
        return int(round(RISK_BAND_LOW_MIN + (FIN_AGRI_SCORE_MAX - RISK_BAND_LOW_MIN) * scaled))

    if predicted_label == "MEDIUM":
        center = (RISK_BAND_LOW_MIN - 1 + RISK_BAND_MEDIUM_MIN) / 2.0  # ≈ 624.5
        half_span = (RISK_BAND_LOW_MIN - 1 - RISK_BAND_MEDIUM_MIN) / 2.0  # ≈ 74.5
        tilt = _clip(p_low - p_high, -1.0, 1.0)
        return int(round(center + tilt * half_span))

    scaled = _clip(p_high)
    upper = RISK_BAND_MEDIUM_MIN - 1  # 549
    span = upper - FIN_AGRI_SCORE_MIN  # 249
    return int(round(upper - span * scaled))


def compute_risk_band(fin_agri_score: int) -> str:
    if fin_agri_score >= RISK_BAND_LOW_MIN:
        return "Low"
    if fin_agri_score >= RISK_BAND_MEDIUM_MIN:
        return "Medium"
    return "High"


def compute_recommendation(risk_band: str) -> str:
    if risk_band == "Low":
        return (
            "We would be comfortable with a standard credit decision, subject to your "
            "policy checks. Main message: the model sees this case as lower risk at this time."
        )
    if risk_band == "Medium":
        return (
            "We would not close this on plain vanilla terms without mitigants. "
            "Consider guarantor, smaller ticket, staged pay, or in-kind support, "
            "then have the officer re-check income and the season plan before a final sign-off."
        )
    return (
        "We would not put this on standard terms without a manual review. "
        "Options: decline, add security, or re-scope to a smaller pilot; update the file "
        "and re-run when the household story is stronger."
    )


def decide_predicted_label(
    class_probabilities: Dict[str, float],
    low_threshold: float,
) -> Tuple[str, float]:
    """Decide class with argmax, using LOW threshold as a confidence guard.

    Rules:
      1) Start from argmax over HIGH/MEDIUM/LOW probabilities.
      2) If argmax is LOW but P(LOW) is below threshold, fall back to the
         next-most-probable class.

    Note: `model_metadata.json` may also define a separate `decision_logic` block
    (e.g. min_confidence + fallback class) from the Colab training notebook. The
    deployed service intentionally uses the rules here for parity with the
    Fin-Agri score bands; align both if you need strict match to a research notebook.

    This avoids collapsing many records into LOW just because P(LOW) exceeds a
    small calibrated threshold (e.g. 0.19) while another class has stronger
    probability mass.
    """
    p_low = float(class_probabilities.get("LOW", 0.0))
    ranked = sorted(class_probabilities.items(), key=lambda kv: kv[1], reverse=True)
    best_label = ranked[0][0] if ranked else "MEDIUM"
    if best_label == "LOW" and p_low < low_threshold:
        fallback = ranked[1][0] if len(ranked) > 1 else "MEDIUM"
        return fallback, p_low
    return best_label, p_low

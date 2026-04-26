# Fin-Agri Score — Implementation plan (from strict audit)

Priorities follow the agreed order. Status is updated as work lands.

## Legend

| Priority   | Meaning |
|-----------|---------|
| **Critical** | Model fidelity or presentation credibility at risk |
| **Important** | Strongly recommended before “complete” |
| **Polish** | UX / responsive / visual pass after core fixes |

| Layer | `B` backend | `F` frontend | `I` inference |

---

### 1. Crop / categorical mapping (`crp_main` and related)

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Map UI crop labels → training **numeric** `crp_main` via `artifacts/output/crop_main_codes.json`; load in `featureBuilder.js`; numeric string passthrough | **Critical** | B | `backend/src/services/featureBuilder.js`, `artifacts/output/crop_main_codes.json`, `artifacts/README.md` |
| Optional: extend `crop_main_codes.json` when training `value_counts` for `crp_main` are exported | **Important** | — | Same JSON + brief note |
| Review other categoricals (`hh_education`, `income_*` strings) for training alignment | **Important** | B | `featureBuilder.js` |

---

### 2. Inference service vs saved artifacts

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| FastAPI app description + comments: no hard-coded wrong model family; align with `model_metadata.json` / actual `joblib` | **Critical** | I | `inference/app/main.py`, `inference/app/model_loader.py`, `inference/app/explain.py` |
| SHAP `explain.py` docstring: pipeline-agnostic (tree ensemble), not “XGB-only” | **Critical** | I | `inference/app/explain.py` |

---

### 3. `P(LOW)` naming (formerly “repayment probability”)

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Inference API: expose `p_low_risk` (probability of **LOW** credit-risk class); remove misleading `repayment_probability` key from response | **Critical** | I, B, F | `inference/app/schemas.py`, `inference/app/main.py`, `backend/src/services/scoringService.js`, `backend/src/controllers/assessmentsController.js`, `frontend/src/components/ScoreCard.jsx`, `frontend/src/pages/ApplicationDetailPage.jsx`, `backend/src/services/reportPdfService.js` |
| DB column `repaymentProbability` unchanged (stores same scalar); CSV column labels may note “p_low_risk (stored)” in a later pass | **Important** | B | `reportsController.js` (optional follow-up) |

---

### 4. Other artifact-driven scoring inconsistencies

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Document gap: `model_metadata.json` → `decision_logic` (e.g. min confidence) vs `decide_predicted_label()` in code | **Important** | I | `inference/app/scoring.py` + comment or future alignment |
| `_build_feature_row` “imputed” = missing keys (not sklearn imputation) — clarify in docstring | **Polish** | I | `inference/app/main.py` |

---

### 5. Asset model

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Either surface `Asset` in farmer workflow **or** remove from product story / schema (decision) | **Important** | B, F | `schema.prisma`, farmer pages, routes |

---

### 6. Explanation text (non-technical)

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Expand `ExplanationPanel` templates + fallbacks | **Important** | F | `frontend/src/components/ExplanationPanel.jsx` |

---

### 7. Responsiveness and polish

| Item | Priority | Layers | Files |
|------|----------|--------|--------|
| Max-width, tables, score wizard on small viewports | **Polish** | F | `theme.css`, page layouts |

---

## Execution order (this PR)

1. **Critical (implemented):** §1 (crop map + `crop_main_codes.json` + `featureBuilder`), §2 (inference OpenAPI / `model_loader` / `explain` text; no wrong model name in docs), §3 (`p_low_risk` in inference + Node + UI + PDF), §4 (docstring on `decision_logic` vs deployed `decide_predicted_label`; `_build_feature_row` “imputed” clarification).
2. **Next PRs:** §5 ( decision recorded below), remaining §4.

### §6 — Explanation panel (done)

- `frontend/src/components/ExplanationPanel.jsx` — full rewrite: section hierarchy, “main risk drivers” vs “positive indicators”, expanded `PLAIN_TEMPLATES` + prefix rules, env snapshot + input confidence blocks, wiring from `ScoreApplicationPage` and `ApplicationDetailPage`.
- `ArtifactXaiPanel` copy de-demo’d (“Model training reference”).

### §7 — Responsiveness & polish (done)

- `theme.css` — page max width, header rhythm, `layout-explain-split`, explanation panel / factor-pill / trust styles, `main-area-body`, grid gap tweak, mobile page-header border tweak.
- `AppLayout.jsx` — `main-area-body` wrapper for background/column stretch.

### §5 — Asset (recommendation only; not implemented)

- **Recommend B:** keep table/API for power users or future work but **do not surface in the product story** for the final-year demo. Assets are not inputs to the trained model, not in readiness, and would add UI scope without changing scores. If collateral matters later, add a small optional section in v2.

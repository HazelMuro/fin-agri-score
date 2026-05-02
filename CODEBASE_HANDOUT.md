# Fin-Agri Score — Codebase handout

**Purpose:** One printable reference for code inspection / demonstration (architecture, main files, scoring flow, configuration).

**Product:** Zimbabwe-focused agricultural credit scoring: farmer profiling, environmental context (rainfall / NDVI-style signals), ML-based risk classification, explainability artifacts, CSV/PDF reporting.

---

## 1. Three-layer runtime

| Layer | Folder | Role |
|--------|--------|------|
| **UI** | `frontend/` | React (Vite) dashboard — farmers, applications, scoring wizard, history, reports. |
| **API** | `backend/` | Express REST API, Prisma ↔ PostgreSQL, orchestrates scoring and reports. |
| **ML** | `inference/` | FastAPI — loads trained sklearn pipeline from disk, `POST /predict`. |

**Ports (local demo):** UI `5173`, API `4000`, Inference `8000`, Postgres `5432` (or your mapped port).

**Artifacts (Objective 1 runtime):** `artifacts/output/` — `final_farmer_credit_model.joblib`, label encoder, `feature_columns.json`, `crop_main_codes.json`, `model_metadata.json`, evaluation CSVs/plots.

---

## 2. Request flow (scoring)

1. Officer completes farmer + application data in Postgres (`Farmer`, `LoanApplication`, household, activity, social, satellite…).
2. Backend **`readinessService`** evaluates completeness / confidence before scoring.
3. **`featureBuilder.js`** maps DB rows → flat feature dict aligned with **`feature_columns.json`**.
4. **`inferenceClient.js`** sends features to Python **`POST /predict`**.
5. **`inference/app/scoring.py`** turns class probabilities → **Fin‑Agri Score** and **risk band** (Low / Medium / High).
6. **`scoringService.js`** persists **`CreditScore`**, updates application status, writes **audit** log.

**End-to-end entry point (Node):** `backend/src/services/scoringService.js`  
**Model boundary:** `backend/src/services/featureBuilder.js` + `inference/app/main.py`

---

## 3. Main backend files (quick map)

| File | Responsibility |
|------|----------------|
| `src/server.js` | Binds HTTP server to `PORT`. |
| `src/app.js` | Express app — middleware, mounts `/api/*`, error handlers. |
| `src/config/env.js` | Loads env (database URL, JWT, inference URL, score thresholds). |
| `src/config/prisma.js` | Singleton Prisma client. |
| `src/middleware/requireAuth.js` | JWT **or** open “demo” mode if `JWT_SECRET` unset / short. |
| `src/middleware/errorHandler.js` | Global JSON errors + 404. |
| `src/services/scoringService.js` | Full scoring orchestration (readiness → features → inference → DB). |
| `src/services/featureBuilder.js` | DB → ML feature dictionary + provenance hints. |
| `src/services/inferenceClient.js` | HTTP client to inference service. |
| `src/services/readinessService.js` | Gates scoring on data quality / confirmation. |
| `src/services/environmentService.js` | Satellite/env autofill (NASA POWER + climatology fallback). |
| `src/services/reportPdfService.js` | PDF generation for portfolio / application / farmer summaries. |
| `src/services/xaiArtifactsService.js` | Reads SHAP / CSV artifacts for `/api/xai`. |
| `src/controllers/*.js` | HTTP handlers per domain (thin — logic stays in services). |
| `src/routes/*.js` | Route tables + validation hooks. |
| `prisma/schema.prisma` | Database schema (single source of truth). |
| `prisma/migrations/**` | Applied SQL migrations — do not delete from repo history. |
| `prisma/seed.js` | Demo users, districts, demo farmers; optional Medium presets module. |

---

## 4. Main frontend files (quick map)

| Area | Responsibility |
|------|----------------|
| `src/main.jsx` | React bootstrap. |
| `src/App.jsx` | Router — dashboard, farmers, applications, score wizard, history, reports. |
| `src/layouts/AppLayout.jsx` | Sidebar shell + `<Outlet />`. |
| `src/services/api.js` | Axios instance (`/api`), auth header, friendly errors. |
| `src/services/*.js` | Thin wrappers matching backend routes. |
| `src/pages/*.jsx` | Screen-level components (dashboard, scoring flow, detail pages). |
| `vite.config.js` | Dev server; proxies `/api` → backend `:4000`. |

---

## 5. Inference service (Python)

| File | Responsibility |
|------|----------------|
| `app/main.py` | FastAPI — `/health`, `/predict`. |
| `app/model_loader.py` | Loads joblib pipeline + metadata once at startup. |
| `app/scoring.py` | Probability → Fin‑Agri Score + risk band + recommendation text. |
| `app/explain.py` | Top contributing factors for API response. |
| `requirements.txt` | Python dependencies. |

---

## 6. Environment variables (see `backend/.env.example`)

Copy to `backend/.env` and adjust locally **(never commit real secrets).**

| Variable | Meaning |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string. |
| `PORT` | API port (default `4000`). |
| `INFERENCE_SERVICE_URL` | Base URL for FastAPI (default `http://localhost:8000`). |
| `ARTIFACTS_DIR` | Path to `artifacts/output` for explainability file reads. |
| `CORS_ORIGIN` | Allowed browser origin(s) for the SPA (e.g. `http://localhost:5173`). |
| `JWT_SECRET` | ≥16 chars enables JWT login; unset → open demo API behaviour (see `requireAuth`). |
| `FIN_AGRI_SCORE_*`, `RISK_BAND_*` | Score range and band cut-offs (aligned with Python `scoring.py`). |

Frontend: `frontend/.env` — typically `VITE_API_BASE_URL=http://localhost:4000`.

---

## 7. Useful commands

| Command | Where | Purpose |
|---------|--------|---------|
| `npm run dev` | `backend/` | Start API with nodemon. |
| `npm run dev` | `frontend/` | Start Vite dev server. |
| `uvicorn app.main:app --host 127.0.0.1 --port 8000` | `inference/` | Start inference (after `pip install -r requirements.txt`). |
| `npm run seed` | `backend/` | Seed demo data (requires DB). |
| `npm run seed:medium` | `backend/` | Add three preset **Medium**-band demo scores. |
| `npx prisma migrate deploy` | `backend/` | Apply migrations (production / CI). |

**Windows:** `FIRST_TIME_SETUP.bat` (deps + migrate), **`OBJECTIVE3.bat`** or **`RUN_OBJECTIVE3.bat`** (same launcher — dashboard stack), `STOP_OBJECTIVE3.bat`.

---

## 8. Demo checklist (for inspection day)

1. Postgres running; `DATABASE_URL` correct (watch host **port** vs Docker mapping).
2. `npx prisma migrate deploy` (or fresh `migrate reset` + seed on a throwaway DB).
3. Inference running — `GET http://localhost:8000/health` returns model metadata.
4. API running — `GET http://localhost:4000/api/health` shows DB + inference status.
5. UI — open dashboard at `http://localhost:5173`, walk **Score application** → saved **CreditScore** → **History / Reports**.

---

## 9. Objective alignment (talking points)

| Objective | Deliverable in repo |
|-----------|---------------------|
| **1 — ML** | `artifacts/output/` model + metrics + plots; `inference/` runtime; training notebook / CSV under repo root & `data/`. |
| **2 — Platform** | `backend/` API + Prisma + Postgres + audit + reports. |
| **3 — UX** | `frontend/` officer-facing dashboard and workflows. |

---

## 10. Print note

Export this file to PDF from VS Code / Cursor (**Markdown: Print**), GitHub preview, or `pandoc` if installed:

```bash
pandoc CODEBASE_HANDOUT.md -o CODEBASE_HANDOUT.pdf
```

---

*Generated for inspection walk-through. Implementation details stay in source comments and `README.md`.*

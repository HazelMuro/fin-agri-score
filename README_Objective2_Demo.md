# Fin-Agri Score — Objective 2 Demo Guide

This document describes the **Objective 2** system: an API-based credit scoring service, PostgreSQL persistence, a Python inference microservice that loads Objective 1 artifacts, and a React operator interface for live demonstration.

---

## How to run Objective 2 (local dev)

**Prerequisites:** Node.js, Python 3.10+, PostgreSQL, and the four [Objective 1 files](artifacts/README.md) in `artifacts/output/`.

1. **Database**  
   - Create a database (e.g. `fin_agri_score`).  
   - `cd backend` → copy `.env.example` to `.env` and set `DATABASE_URL`.

2. **Backend**  
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run dev
   ```  
   API: `http://localhost:4000` — check `GET http://localhost:4000/api/health`.

3. **Inference (Python)** — from repo root or `inference/`, with venv and `pip install -r requirements.txt`  
   Set `MODEL_DIR` to the absolute path of `fin-agri-score/artifacts/output` (folder with the four joblib/json files), then:  
   ```bash
   cd inference
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```  
   Check `GET http://localhost:8000/health`.

4. **Operator UI (React + Vite)**  
   ```bash
   cd frontend
   copy .env.example .env
   npm install
   npm run dev
   ```  
   Open `http://localhost:5173` (or the URL Vite prints). `VITE_API_BASE_URL` should be `http://localhost:4000` unless you proxy differently.

5. **Flow:** create a **farmer** → **application** → fill **household / activity / social / environment** until **readiness** allows it → **Run credit score** (or use `POST .../score?` with `force=true` to bypass readiness for demos).

**Env reference:** `backend/.env.example`, `inference/.env.example`, `frontend/.env.example`.

### One-click launch (Windows)

For API + inference only, start the same services as the dashboard stack:

- Double-click **`RUN_OBJECTIVE3.bat`** (starts backend, inference, and the UI). You can close the **frontend** window if you only need `http://127.0.0.1:8000/docs` and `http://localhost:4000/api/health`.
- Double-click **`STOP_OBJECTIVE3.bat`** to stop ports **4000**, **8000**, and **5173**.

There is no separate Objective 2-only launcher; Objective 3’s scripts cover the API and inference ports.

---

## 1. Architecture (summary)

| Layer | Technology | Role |
|--------|------------|------|
| Operator UI | React + Vite | Internal staff workflow: farmers, applications, assessment sections, readiness, scoring, history. |
| API | Node.js + Express | REST API, validation, orchestration, audit logging. |
| Database | PostgreSQL + Prisma | Farmers, applications, supporting assessment rows, satellite/environment, credit scores, users, audit logs. |
| Inference | Python (FastAPI + uvicorn) | Loads **only** Objective 1 joblib/JSON artifacts; runs `predict_proba`; computes Fin-Agri score, risk band, recommendation, top factors. |

**Data flow**

1. Operator uses the React app → calls `http://localhost:4000/api/...`.
2. Express reads/writes PostgreSQL via Prisma.
3. On **score**, Express loads the application, farmer, household income, latest farm activity, social capital, and satellite row; builds a **feature dictionary** whose keys match `feature_columns.json` / the trained pipeline (161 features).
4. Express POSTs `{ features, application_id }` to the Python service `POST /predict`.
5. Python loads `final_farmer_credit_model.joblib`, applies the **same** sklearn `Pipeline` as training, returns probabilities and derived business fields.
6. Express persists `CreditScore`, sets application status to `SCORED`, writes `AuditLog`, returns JSON to the UI.

**Why Node does not load joblibs**

Scikit-Learn / CatBoost pipelines are Python-native. The Node layer never deserialises model binaries; it only passes JSON feature payloads and stores structured results.

---

## 2. Folder structure

```
fin-agri-score/
├── backend/                 # Express API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/        # scoringService, featureBuilder, readiness, inferenceClient, audit
│   │   ├── middleware/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── inference/               # FastAPI microservice
│   ├── app/
│   │   ├── main.py
│   │   ├── model_loader.py
│   │   ├── scoring.py
│   │   ├── explain.py
│   │   └── schemas.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/              # React + Vite operator UI
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── hooks/           # useTheme (light/dark + localStorage)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── artifacts/               # Copy Objective 1 outputs here (see below)
│   └── output/              # optional mirror of Colab `output/`
│       ├── final_farmer_credit_model.joblib
│       ├── final_farmer_credit_label_encoder.joblib
│       ├── feature_columns.json
│       └── model_metadata.json
└── README_Objective2_Demo.md   # (this file)
```

---

## 3. How Objective 1 artifacts are used

| File | Used by | Purpose |
|------|---------|---------|
| `final_farmer_credit_model.joblib` | Python | Full fitted sklearn `Pipeline` (preprocess + `CatBoostClassifier` or your winning model). |
| `final_farmer_credit_label_encoder.joblib` | Python (optional) | Class order / labels for reporting; live predictions use the pipeline. |
| `feature_columns.json` | Python + Node | **Python:** column order for the DataFrame row. **Node:** same list via `all_features` to build a complete key set (missing keys → imputed in-pipeline as at training). |
| `model_metadata.json` | Python | `class_labels`, optional thresholds, reporting `model_version` / selection reason. |
| `feature_importance.csv`, `top_features.json`, etc. | UI / future | Global explainability; optional in Ob2. |

**Important:** `feature_columns.json` may be an object with an `all_features` array. The inference loader normalises that to a plain list before building the design matrix.

---

## 4. Database schema (conceptual)

Entities match Prisma `schema.prisma`:

- **Farmer** — identity, demography, location, farm size, phone, optional national ID, education, household size.
- **HouseholdIncome** — one row per farmer (upsert): income sources/amounts, shock flag, coping index, dietary diversity.
- **LoanApplication** — amount, purpose, season, status (`PENDING` → `SCORED`, etc.).
- **FarmActivity, Asset, SocialCapital** — supporting assessment (farmer-scoped for activities/assets/social).
- **SatelliteData** — environment fields scoped to an **application** (rainfall, NDVI, scores, provenance, confirmation).
- **CreditScore** — prediction output, JSON probabilities, Fin-Agri score, risk band, recommendation, model id/version, optional top factors JSON.
- **User** — optional staff accounts.
- **AuditLog** — `APPLICATION_CREATED`, `APPLICATION_SCORED`, `STATUS_CHANGED`, etc.
- **DistrictProfile** (reference) — optional district climatology for autofill.

---

## 5. API surface (REST)

All JSON under `/api` unless noted.

- **Health:** `GET /api/health`
- **Farmers:** `POST/GET /api/farmers`, `GET /api/farmers/:id`
- **Applications:** `GET/POST /api/applications`, `GET /api/applications/:id`, `PATCH /api/applications/:id/status`
- **Scoring:** `POST /api/applications/:id/score` (query: `force`, `rescore`)
- **Assessment scoring (presentation-friendly):** `POST /api/assessments/score`
- **Scores:** `GET /api/scores`, `GET /api/scores/:id`
- **Readiness & assessment:** `GET /api/applications/:id/readiness`, `GET /api/applications/:id/assessment-summary`
- **Environment (district autofill, confirm):** `GET /api/districts`, `POST /api/applications/:id/environment/autofill`, `POST .../confirm`, `PATCH .../environment`
- **Supporting:** `POST /api/farm-activities`, `POST /api/assets`, `POST /api/social-capital`, `POST /api/household-income`, `POST /api/satellite-data`, `GET /api/audit-logs`, `POST /api/audit-logs`
- **Dashboard:** `GET /api/dashboard/overview`, score history as implemented in `dashboard` routes

List endpoints support `?status=`, `?farmerId=`, `?take=`, `?skip=`, `?q=` where applicable.

`POST /api/assessments/score` body example:

```json
{
  "application_id": "cmo8jw3q70034zh3fem9l5uv7",
  "force": false,
  "rescore": false
}
```

Response includes objective evidence fields:
`farmer_id`, `application_id`, `predicted_label`, `repayment_probability`, `fin_agri_score`, `risk_band`, `recommendation`, and `saved_score_id`.

Important consistency note:
- `POST /api/assessments/score` is the **authoritative scoring path** used by the dashboard.
- FastAPI `POST /predict` is a low-level model endpoint that accepts partial feature maps and can impute many missing fields; therefore it is useful for model checks but not for strict UI parity demonstrations.

---

## 6. Scoring & duplicate protection

- **Readiness gate** — `readinessService` must allow scoring (or use `?force=true` for admin-style demo).
- **Dedupe** — if a score was created within `SCOREDEDUPESECONDS` (default 60) and `rescore` is not true, the API returns the **existing** score instead of re-calling the model.
- **UI** — submit/score buttons should disable while a request is in flight (implemented in the React app).

---

## 7. Operator interface (user flow)

1. **Dashboard** — counts and recent activity.
2. **Farmers** — create and search; open **Farmer detail** (applications, quick actions).
3. **Applications** — create (linked to farmer), filter by status, open **Application detail**.
4. **Application detail** — sections: farmer summary, loan, **household income**, **farm activity**, **social capital**, **environment/satellite** (autofill/confirm), **readiness** checklist, **Run credit score** (when allowed).
5. **Score** — Fin-Agri score, label, repayment-related probability, risk band, recommendation, top factors, optional expandable raw JSON.
6. **History** — recent scored applications.

**Theme:** light/dark toggle, persisted in `localStorage`, system preference on first visit.

---

## 8. Step-by-step demonstration (presentation script)

1. Open the operator UI (e.g. `http://localhost:5173`).
2. **Create a farmer** — name, district, province, age, phone, farm size.
3. **Create a loan application** — amount, purpose, season.
4. **Add household income** — main/secondary income, optional coping/diversity fields.
5. **Add farm activity** — crop, irrigation, season.
6. **Add social capital** — group membership, guarantor, etc.
7. **Add or autofill environment** — rainfall/NDVI (or use district autofill, then confirm).
8. Open **readiness** — show green/amber states and any blocking items.
9. **Run score** — wait for success; show that the result is **not** static (probabilities, model name/version in response/metadata).
10. **Refresh / history** — show stored **CreditScore** and **audit** entry in DB.
11. Explain: **Node** orchestrates; **Python** runs the real Objective 1 pipeline; **PostgreSQL** stores the audit trail.

---

## 9. Environment variables

**Backend `backend/.env`**

- `DATABASE_URL=postgresql://USER:PASS@localhost:5432/fin_agri`
- `INFERENCE_SERVICE_URL=http://localhost:8000`
- `CORS_ORIGIN=http://localhost:5173`
- `SCORE_DEDUPE_SECONDS=60`
- `READINESS_ALLOW_WARNINGS=true` (tune for strict demos)

**Inference `inference/.env`**

- `MODEL_DIR=../artifacts/output` (absolute or relative to cwd when starting uvicorn)
- `CORS_ORIGINS=http://localhost:4000,http://localhost:5173` (if using browser tools against FastAPI)
- Optional: `LOW_CLASS_THRESHOLD` (defaults from `model_metadata.json` decision logic)

**Frontend `frontend/.env`**

- `VITE_API_BASE_URL=http://localhost:4000`

---

## 10. Run commands (development)

**Terminal 1 — PostgreSQL**  
Ensure PostgreSQL is running and `DATABASE_URL` is valid.

**Terminal 2 — Migrations & seed (first time)**  
`cd backend && npx prisma migrate deploy && npx prisma generate`  
(optional) `npx prisma db seed`

**Terminal 3 — API**  
`cd backend && npm run dev`

**Terminal 4 — Inference**  
`cd inference` — create venv, `pip install -r requirements.txt`, set `MODEL_DIR` to the folder with four artifacts, then:  
`uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

**Terminal 5 — UI**  
`cd frontend && npm run dev`

---

## 11. Sample API payloads

**Create farmer**

```json
{
  "fullName": "Tendai Moyo",
  "gender": "Female",
  "age": 42,
  "phone": "+263771234567",
  "province": "Mashonaland East",
  "district": "Murehwa",
  "ward": "Ward 12",
  "farmSizeHa": 3.2,
  "education": "Secondary",
  "householdSize": 5
}
```

**Create application**

```json
{
  "farmerId": "<cuid>",
  "amountRequested": 1500,
  "purpose": "Maize seed and fertiliser for 2025/26 season",
  "season": "2025/2026"
}
```

**Score (after readiness OK)**

`POST /api/applications/<id>/score`  
Body (optional): `{ "rescore": false }` or `{ "force": true }` to bypass readiness in demo.

---

## 12. Troubleshooting

| Issue | What to check |
|--------|----------------|
| 503 on inference `/health` | `MODEL_DIR` path; four files present; same NumPy / sklearn major versions as training when possible. |
| 422 on score | Readiness: complete household, activity, social, environment per `readinessService`, or use `force`. |
| All-imputed features | Normal if Ob2 form only fills a subset; more fields in DB = fewer nulls. |
| CORS errors | `CORS_ORIGIN` in backend; `VITE_API_BASE_URL` in frontend. |

---

This file is the single place for **Objectives 2** demo setup, architecture, and presentation flow. For field-level API details, see inline comments in `backend/src` and OpenAPI (FastAPI auto-docs: `http://localhost:8000/docs`).

# Fin-Agri Score

**Zimbabwe-focused agricultural credit scoring, farmer risk assessment, and explainable lending decision-support platform.**

Fin-Agri Score is one integrated full-stack product built for banks and microfinance institutions that serve Zimbabwe's smallholder farmers. It combines agricultural intelligence (rainfall, NDVI), farmer profiling, and a trained machine-learning model into a single, presentation-ready dashboard.

> Objective 1 produced the trained ML model · Objective 2 produced the backend & database · Objective 3 produced the React dashboard. All three are represented inside this one final application.

---

## 1. Architecture at a glance

```
┌──────────────┐    REST    ┌──────────────┐    REST    ┌───────────────┐
│ React + Vite │ ─────────▶ │ Node/Express │ ─────────▶ │ Python FastAPI │
│  dashboard   │            │  + Prisma    │            │  inference     │
│  (Obj 3)     │            │  (Obj 2)     │            │  (Obj 1)       │
└──────────────┘            └──────┬───────┘            └───────┬───────┘
                                   │                            │
                                   ▼                            ▼
                            ┌──────────────┐            ┌───────────────┐
                            │ PostgreSQL   │            │  /data/*.joblib│
                            │  (Obj 2)     │            │  model files   │
                            └──────────────┘            └───────────────┘
```

- **React frontend** (`frontend/`) — the only thing the end user touches.
- **Node backend** (`backend/`) — REST API, Postgres (via Prisma), scoring orchestration, audit logs.
- **Python inference** (`inference/`) — minimal FastAPI service that loads the XGBoost model from `/data` and returns predictions + SHAP explanations.
- **PostgreSQL** — persistence for all records.
- **/data** — the four Objective-1 artifacts (model, encoder, feature list, metadata).

## 2. Folder structure

```
fin-agri-score/
├── backend/            Node.js + Express + Prisma        (Objective 2)
├── frontend/           React + Vite dashboard             (Objective 3)
├── inference/          Python FastAPI inference layer     (Objective 1 runtime)
├── README.md
├── README_Objective1_Mapping.md
├── README_Objective2_Mapping.md
├── README_Objective2_Demo.md
├── README_Objective3_Mapping.md
└── README_Final_System_Demo.md
```

The trained model artifacts live outside this folder, in `C:/Users/user/OneDrive/Desktop/hazel/data/` — the inference service reads them from there via the `MODEL_DIR` environment variable.

## 3. Quick start (Windows — PowerShell)

Prerequisites:

- **Node.js 18+**
- **Python 3.10+**
- **PostgreSQL 14+** (locally or on any host you can reach)

Open 3 PowerShell windows, one for each service.

### 3.1 Inference microservice

```powershell
cd fin-agri-score\inference
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Edit .env and make sure MODEL_DIR points to your /data folder

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify: open `http://localhost:8000/health` — you should see the model metadata.

### 3.2 Backend

```powershell
cd fin-agri-score\backend
npm install

copy .env.example .env
# Edit .env — set DATABASE_URL to your local Postgres

npm run prisma:generate
npm run prisma:migrate
npm run seed

npm run dev
```

Verify: open `http://localhost:4000/api/health`.

### 3.3 Frontend

```powershell
cd fin-agri-score\frontend
npm install

copy .env.example .env

npm run dev
```

Open `http://localhost:5173` — the dashboard appears. The demo data seeded in step 3.2 means you can immediately click **Score application** and run a prediction.

## 4. Environment variables

| Service | Key | Meaning |
|---|---|---|
| inference | `MODEL_DIR` | Absolute path to folder containing the `.joblib` files |
| inference | `INFERENCE_PORT` | HTTP port (default 8000) |
| inference | `LOW_CLASS_THRESHOLD` | Overrides the threshold from model_metadata.json |
| backend | `DATABASE_URL` | PostgreSQL connection URL |
| backend | `INFERENCE_SERVICE_URL` | Base URL of the Python service |
| backend | `CORS_ORIGIN` | Comma-separated allowed origins for the API |
| frontend | `VITE_API_BASE_URL` | Base URL of the Node backend (empty = use Vite proxy) |

## 5. Objective mapping (short version)

| Objective | Where it lives in the product |
|---|---|
| **1 — trained model** | `data/*.joblib` + the Python `inference/` service that wraps it |
| **2 — backend API + DB** | `backend/` — Express routes, Prisma schema, scoring orchestrator, audit logs |
| **3 — interactive dashboard** | `frontend/` — React UI, scoring page, explanation panel, environmental insights, history |

See the dedicated mapping files for the long version:

- [`README_Objective1_Mapping.md`](./README_Objective1_Mapping.md)
- [`README_Objective2_Mapping.md`](./README_Objective2_Mapping.md)
- [`README_Objective3_Mapping.md`](./README_Objective3_Mapping.md)
- [`README_Final_System_Demo.md`](./README_Final_System_Demo.md)

## 6. Editing / maintenance guide

| What | Where |
|---|---|
| Colors, spacing, typography | `frontend/src/styles/theme.css` (single source of truth — edit CSS variables) |
| Sidebar links, nav structure | `frontend/src/layouts/AppLayout.jsx` |
| Reusable components | `frontend/src/components/` |
| Individual pages | `frontend/src/pages/` |
| API calls from the frontend | `frontend/src/services/` |
| Backend routes | `backend/src/routes/` |
| Request handlers | `backend/src/controllers/` |
| Scoring orchestration | `backend/src/services/scoringService.js` |
| How DB data becomes model features | `backend/src/services/featureBuilder.js` |
| DB tables | `backend/prisma/schema.prisma` |
| Seed / demo data | `backend/prisma/seed.js` |
| Inference logic / score math | `inference/app/scoring.py` |
| Feature humanization (SHAP labels) | `inference/app/explain.py` (`FRIENDLY_LABELS`) |
| Model artifacts path | `MODEL_DIR` env var (no code change needed) |

## 7. API summary

- `GET  /api/dashboard/overview` — KPIs, risk distribution, recent applications
- `GET  /api/farmers` · `POST /api/farmers` · `GET /api/farmers/:id`
- `GET  /api/applications` · `POST /api/applications` · `GET /api/applications/:id`
- `POST /api/applications/:id/score` — run Fin-Agri Score
- `GET  /api/scores` · `GET /api/scores/:id`
- `POST /api/farm-activities` · `POST /api/assets` · `POST /api/social-capital` · `POST /api/satellite-data`
- `POST /api/users` · `GET /api/audit-logs`
- `GET  /api/health` · `GET /` (service metadata)

## 8. Demo payloads

**Score an application:**

```bash
curl -X POST http://localhost:4000/api/applications/{APP_ID}/score
```

Response (abridged):

```json
{
  "score": { "finAgriScore": 724, "riskBand": "Low", "predictedLabel": "LOW" },
  "prediction": {
    "fin_agri_score": 724,
    "risk_band": "Low",
    "recommendation": "Approve — standard terms...",
    "top_factors": [
      { "feature": "chirps_rain_90d_mm", "label": "Rainfall, last 90 days (mm)", "direction": "reduces_risk", "impact": 0.412 }
    ]
  }
}
```

## 9. License

Academic / demonstration use.

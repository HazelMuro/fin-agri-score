# Fin-Agri Score — Objective 3 Demo Guide

Objective 3 is the **interactive, XAI-enabled dashboard layer** of the project:

- Objective 1: trained model artifacts
- Objective 2: API + PostgreSQL + scoring orchestration
- Objective 3: this React dashboard used by loan officers

This guide explains how to run and present Objective 3 live.

### Farmer assets (API/schema only — out of scope in the UI)

The database includes an optional **`assets`** table and the backend exposes `POST /api/assets` (see supporting routes) so collateral-style rows can be stored per farmer. **The officer-facing dashboard intentionally does not include an assets workflow in this version.** Assets are not model inputs, not part of readiness scoring, and are not required for a successful live demo. Treat them as schema/API for future or external tools unless you add UI later.

---

## 1) What each page is for

### Dashboard Home (`/`)
- Operational overview for supervisors and loan officers
- Shows totals (farmers, applications, scored, average score)
- Shows portfolio risk distribution
- Shows recent applications and recent scoring activity

### Farmers (`/farmers`)
- Register and search farmers
- Open a farmer profile to review all linked records

### Farmer Detail (`/farmers/:id`)
- Full farmer profile
- Farm activities, social capital, household income
- Linked applications

### Applications (`/applications`)
- Create and filter loan applications
- Shows status and assessment-readiness state per row

### Application Detail (`/applications/:id`)
- Full application review in one place
- Readiness + confidence panel
- Latest score, explanation panel, environmental panel
- Score history and audit trail

### Score Application (`/score`)
- Guided workflow for loan officers:
  1. Select application
  2. Farm + household
  3. Social capital
  4. Environmental data (autofill/confirm)
  5. Review and score
- Clear readiness gate before scoring
- Returns explainable result (score + risk + top factors)

### Score History (`/history`)
- Stored scoring runs with search/filter/sort
- Open any scored application for full detail review

### Reports & downloads (`/reports`)
- **Portfolio CSV exports**: applications, score history, farmers registry, 12-month summary, audit log (UTF-8 BOM for Excel)
- **Portfolio PDF**: one-page summary aligned with the dashboard overview (`GET /api/reports/portfolio-summary.pdf`)
- **Case-level exports** (from farmer or application detail, or after scoring): single-row CSV and committee-style case PDF for that farmer or application

---

## 2) How Objective 3 connects to backend

The frontend does **not** run the model directly.

It calls Objective 2 APIs (examples):
- `GET /api/dashboard/overview`
- `GET /api/farmers`, `GET /api/farmers/:id`
- `GET /api/applications`, `GET /api/applications/:id`
- `GET /api/applications/:id/readiness`
- `POST /api/applications/:id/score`
- `GET /api/scores`, `GET /api/scores/:id`
- `GET /api/audit-logs`
- `POST /api/auth/login`, `GET /api/auth/me` (JWT session when `JWT_SECRET` is configured — see `DEPLOY.md`)

**Reports & exports** (binary PDF/CSV responses; same base URL as other `/api` routes):

- `GET /api/reports/applications.csv`, `score-history.csv`, `farmers.csv`, `monthly-summary.csv`, `audit-log.csv`
- `GET /api/reports/portfolio-summary.pdf`
- `GET /api/reports/applications/:id/summary.csv` · `summary.pdf`
- `GET /api/reports/farmers/:id/summary.csv` · `summary.pdf`

On scoring:
1. Frontend calls backend score endpoint
2. Backend assembles payload and calls Python inference
3. Backend saves score in PostgreSQL
4. Frontend renders returned score + explanation + provenance/confidence

### Artifact-derived XAI endpoints (Objective 1 outputs via backend)

The backend now exposes saved Objective 1 explanation artifacts:

- `GET /api/xai/overview`
- `GET /api/xai/feature-importance`
- `GET /api/xai/sample-explanations`
- `GET /api/xai/evaluation-summary`

These read from `ARTIFACTS_DIR` (default `../artifacts/output`) and power
global explainability cards in the dashboard and scoring/application detail pages.

---

## 3) Explainability (XAI) in the dashboard

The dashboard presents explainability in loan-officer language:

- **Why this score?** panel
- Top contributing factors
- Split into:
  - factors reducing risk
  - factors increasing risk
- Plain-language interpretation text for key features

This is shown on Score and Application Detail screens for immediate decision support.

---

## 4) Readiness and provenance display

Objective 3 emphasizes trustworthiness, not only field presence.

The UI shows:
- completeness %
- confidence %
- readiness state (`incomplete`, `needs_review`, `ready_with_warnings`, `ready_to_score`, `scored`)
- section-level gaps and warnings
- provenance badges (`user`, `autofill_live`, `autofill_fallback`, `confirmed`, `derived`, `missing`)

This helps officers understand data quality before using the score.

---

## 5) Theme system (light + dark)

The dashboard supports:
- Light mode and dark mode
- Theme toggle in top bar
- Saved in `localStorage`
- System preference used on first load
- Token-driven styling in `frontend/src/styles/theme.css`

All major UI surfaces are themed:
sidebar, topbar, cards, forms, tables, readiness panels, score panels, history.

Presentation polish includes **responsive wide tables** (horizontal scroll, optional sticky first column where it helps), **theme-aware dashboard charts** (tooltips/legends), and basic **accessibility** (skip link to main content, sidebar `aria-expanded` / `aria-controls` on the mobile menu, visible focus styles on primary controls).

---

## 6) Run commands

### Easiest (no typing each time) — **yes, still the `.bat` files on Windows**

From the **`fin-agri-score/`** project root:

1. **Once:** `FIRST_TIME_SETUP.bat` — installs backend + frontend npm deps, Prisma client/migrations, and the inference `.venv`.
2. **Whenever you work:** `RUN_OBJECTIVE3.bat` — opens three terminals (API **4000**, inference **8000**, Vite **5173**) and your browser at the dashboard.
3. **Stop:** `STOP_OBJECTIVE3.bat` — kills listeners on **4000 / 5173 / 8000**.

**Docker** (Postgres + API + static UI in containers) is optional; see **`DEPLOY.md`** in the repo root if you prefer that over the batch files.

### Backend (Objective 2)
```bash
cd backend
npm run dev
```

### Inference service (Objective 1 runtime)
```bash
cd inference
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend (Objective 3)
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Default frontend env:
```env
VITE_API_BASE_URL=http://localhost:4000
```

Open the URL printed by Vite (usually `http://localhost:5173`).

### Sign-in & secured API (P9)

- If **`JWT_SECRET`** is **not** set (or is shorter than 16 characters) in `backend/.env`, the API stays in **open demo mode** and the UI skips the login screen.
- To **require sign-in**, set `JWT_SECRET` to a long random value in `backend/.env`, restart the API, then use **`/login`** with seeded credentials (after `npm run seed`): **`loan.officer`** / **`officer123`** (or **`admin`** / **`admin123`**).
- **Docker Compose** (Postgres + API + inference + nginx UI): see **`DEPLOY.md`** in the repo root (`docker compose up --build`, then seed inside the API container).

---

## 7) Live demo script (what to click and what to say)

Use this exact sequence in presentation:

1. **Sign-in (only if JWT is enabled on the API)**
   - Use **`/login`** with `loan.officer` / `officer123` (seeded). Skip this step in open demo mode.

2. **Dashboard Home**
   - Say: “This is the operational portfolio overview: volumes, risk distribution, and recent scoring activity.”

3. **Farmers → open one profile**
   - Say: “This screen centralizes farmer profile and supporting assessment records.”

4. **Applications → open one application**
   - Say: “Here we review the full application and current readiness status.”

5. **Score Application workflow**
   - Step through sections quickly
   - Show environmental autofill and confirmation
   - Show readiness confidence before scoring
   - Say: “The system prevents blind scoring when key inputs are missing.”

6. **Run score**
   - Say: “This button calls the Objective 2 API, which invokes the Objective 1 model service.”
   - Show Fin-Agri score, risk band, recommendation

7. **Explainability panel**
   - Say: “These factors explain why this score was produced — both risk drivers and strengths.”

8. **Score History**
   - Say: “All scoring outputs are persisted and retrievable; this is not a hardcoded demo.”

9. **Reports & downloads**
   - Open **Reports** from the sidebar (or links on dashboard/history/detail pages).
   - Say: “Officers can pull portfolio-wide CSVs for audits and Excel, a one-page portfolio PDF that mirrors the dashboard numbers, and per-case CSV/PDF from any farmer or application screen for committee packs.”
   - Optionally click **Download PDF** on the portfolio summary row to show the file landing in the browser.

Closing line:
> “Objective 3 is this interactive XAI-enabled dashboard layer that exposes the Objective 1 model through the Objective 2 API and persistence stack in a loan-officer-friendly interface.”

---

## 8) Troubleshooting

- **`FIRST_TIME_SETUP.bat` fails with `EPERM` … `query_engine-windows.dll.node` (Prisma):**
  - Something is **locking** the Prisma engine file: usually a **still-running** `npm run dev` (backend), another terminal using that `backend` folder, or **OneDrive** syncing a repo under `OneDrive\Desktop\…`.
  - **Fix:** run **`STOP_OBJECTIVE3.bat`**, close every Command Prompt / PowerShell / Cursor terminal that was running the API or frontend, wait a few seconds, then run **`FIRST_TIME_SETUP.bat`** again.
  - If it keeps failing, **move the whole `fin-agri-score` folder** to a path **outside** OneDrive (for example `C:\dev\hazel\fin-agri-score`) and run setup from there, or pause OneDrive for that folder.

- Frontend loads but no data:
  - Check backend `http://localhost:4000/api/health`
- Score button fails:
  - Check inference `http://127.0.0.1:8000/health`
  - Check readiness panel for blocking sections
- CORS/API errors:
  - Confirm `VITE_API_BASE_URL` and backend `CORS_ORIGIN`
- Duplicate scoring confusion:
  - Backend dedupe may return recent score; use explicit re-score action when needed
- Artifact XAI cards empty:
  - Ensure `feature_importance.csv`, `top_features.json`, `sample_shap_explanations.json`, and `evaluation_summary.json` exist under `ARTIFACTS_DIR`
- CSV or PDF download fails from Reports or detail pages:
  - Confirm the backend is up (`/api/health`) and the browser is using the correct `VITE_API_BASE_URL` (same origin or allowed CORS). PDF generation uses `pdfkit` on the server; if install failed, re-run `npm install` in `backend`.

---

Objective 3 is complete when you can smoothly demonstrate:
Dashboard → Farmer/Application review → Readiness → Scoring → Explanation → Stored history → **Reports / exports**.

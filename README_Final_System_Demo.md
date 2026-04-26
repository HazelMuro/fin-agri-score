# Final System Demo Guide

This is the runbook for presenting Fin-Agri Score as **one finished product** while still being able to point at where each of the three project objectives lives.

## 1. Before you walk into the room

Three services must be running:

1. **Inference (Python)** — `uvicorn app.main:app --host 0.0.0.0 --port 8000` from `inference/`
2. **Backend (Node)** — `npm run dev` from `backend/`
3. **Frontend (React)** — `npm run dev` from `frontend/`

Open `http://localhost:5173` in the browser — you should land on the dashboard with seeded demo data (5 farmers, 5 applications).

Also open `http://localhost:8000/health` in a second browser tab — this gives you a quick "the model is loaded" fact to show during the intro.

## 2. The 7-minute demo script

### Step 1 — Show the product, not the pieces (60 s)
Open the dashboard at `/`. Say:

> "This is Fin-Agri Score — a credit-scoring and decision-support platform for Zimbabwean banks lending to smallholder farmers. Loan officers register farmers, submit loan applications, and run an AI-driven score that tells them how likely the farmer is to repay."

Point at the KPI row (farmers, applications, scored, average score), the risk-distribution pie, and the recent-applications table. Keep it high-level.

### Step 2 — Farmers (60 s)
Go to **Farmers** → open any farmer → come back. Point out:

- The sectioned registration form (non-technical-user friendly)
- The farmer detail page with related applications, activities, and social capital

### Step 3 — Applications (45 s)
Go to **Applications**. Open one that is still `PENDING`.

### Step 4 — Score it live (90 s) — **this is the centrepiece**
Click the **Score now** button → it takes you to the Score page with the application preselected → hit **Run Fin-Agri Score**. Within ~1 second the result appears. Narrate:

- "The big number — 300–850, just like a regular credit score."
- "The risk band — green, amber, red."
- "A plain-English recommendation for the officer."
- "A breakdown of class probabilities."

### Step 5 — Why this score? (60 s)
Scroll down to the **Why this score?** panel. Point to the top factors — say:

> "This is SHAP explainability — the model tells us which inputs pushed the score up (green) and which pushed it down (red). For a loan officer who doesn't know what XGBoost is, this is what makes the decision defensible."

Point to the **Environmental & Agronomic Insights** panel next to it and say:

> "This is the agricultural intelligence side — rainfall, vegetation health, and an environmental risk indicator. These are features that don't exist in traditional credit bureaus."

### Step 6 — History & audit (60 s)
Go to **Score History** → filter by `Low risk` → open the application → scroll to the **Audit trail**.

> "Every scoring run is persisted with the model version used, who triggered it, and what the decision was. That's essential for regulated lending."

### Step 7 — Objective mapping (90 s)
End the demo with this slide / statement:

> "What you just saw is one integrated product, but three objectives are each clearly represented inside it:
>
> - **Objective 1** — the trained XGBoost model. It's those four files in `/data`, served by a lightweight Python inference microservice. We never retrain it.
> - **Objective 2** — the API and database. Node, Express, Prisma, and PostgreSQL. Every farmer, application, score, and audit event sits in that database.
> - **Objective 3** — the React dashboard you just used. It talks only to the Node backend. The scoring page, the explanation panel, the environmental insights, the history — all of it."

## 3. Useful demo URLs

| What | Where |
|---|---|
| The product | http://localhost:5173 |
| Backend root (endpoint list) | http://localhost:4000 |
| Backend health + inference health | http://localhost:4000/api/health |
| Inference health + model info | http://localhost:8000/health |
| OpenAPI / FastAPI docs (inference) | http://localhost:8000/docs |
| Prisma Studio (DB browser) | `npm run prisma:studio` in `backend/` |

## 4. If something fails during the demo

- **"Scoring failed"** on the Score page → check that the Python service is up (`http://localhost:8000/health`).
- **Empty dashboard** → run `npm run seed` in `backend/`.
- **CORS error in browser console** → the frontend dev server proxies `/api/*`; make sure you opened it at `http://localhost:5173`, not a file:// URL.
- **Database connection error** on Node startup → check `DATABASE_URL` in `backend/.env`.

## 5. Talking points if a supervisor asks deeper questions

- **"Why 300–850 for the score?"** — deliberate: it's the range every banker already reads fluently, which means the dashboard is legible to a loan officer on day one.
- **"What does `LOW` mean?"** — in the training data, `LOW` = low default risk, i.e. the *good* outcome. `HIGH` = high default risk. The repayment probability we show is `P(LOW)`.
- **"Why a separate Python service?"** — the model is a joblib XGBoost pipeline. Loading it in Node would require re-implementing preprocessing; running it in Python keeps training and serving bitwise identical.
- **"Why Prisma?"** — type-safe ORM with migrations, same tool owning the schema and the query layer, and a built-in DB UI (`prisma studio`) that is useful during the demo.
- **"Where is the threshold applied?"** — `inference/app/scoring.py` → `decide_predicted_label()` applies the `low_class_threshold` from `model_metadata.json` (currently 0.19).
- **"How does SHAP work here?"** — `TreeExplainer` on the underlying XGBoost booster, run on the already-preprocessed feature row so the contributions line up with the model's internal view. Top-6 are returned, with friendly labels.

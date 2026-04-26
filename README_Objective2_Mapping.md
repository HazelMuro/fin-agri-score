# Objective 2 Mapping — Backend API, Database, Scoring Service

## What Objective 2 required

> An API-based credit-scoring service, a PostgreSQL database for farmer/loan records, and a pipeline that turns an application into a stored, auditable credit score.

## Companion doc

For **setup, environment variables, presentation script, and sample payloads**, see **`README_Objective2_Demo.md`** in the repo root.

## What was built

A **Node.js + Express + Prisma** backend (`backend/`) that:

1. Owns the **PostgreSQL schema** with 9 tables.
2. Exposes a clean **REST API** for farmers, applications, scores, supporting records, and the dashboard.
3. Runs the **scoring orchestration**: gather data → call Python inference → persist → audit → respond.
4. Validates every inbound payload and returns structured JSON errors.

## Database schema (9 required tables)

Defined in `backend/prisma/schema.prisma`.

| Table | Role |
|---|---|
| `farmers` | Farmer profiles (name, gender, age, province, district, ward, farm size, phone, national ID) |
| `loan_applications` | Loan requests (farmer, amount, purpose, season, status) |
| `credit_scores` | Scoring outputs (predicted label, probabilities, Fin-Agri Score, risk band, recommendation, top factors, model metadata) |
| `farm_activities` | Crop, yield, irrigation, season, input usage per farmer |
| `assets` | Asset type, name, quantity, estimated value |
| `social_capital` | Group membership, years in group, leadership, guarantor availability |
| `satellite_data` | CHIRPS rainfall, MODIS NDVI, environment score/risk per application |
| `users` | System users (username, email, bcrypt hash, role, active) |
| `audit_logs` | Action history (`APPLICATION_CREATED`, `APPLICATION_SCORED`, `STATUS_CHANGED`) |

Relations enforce referential integrity (e.g. deleting a farmer cascades to their applications, activities, and assets; deleting an application cascades to its credit scores and satellite data).

## REST API

All endpoints are prefixed with `/api`.

### Dashboard
- `GET /dashboard/overview` — totals, risk distribution, recent applications
- `GET /dashboard/score-history` — recent scoring runs

### Farmers
- `GET /farmers` (supports `?q=`, `?district=`, `?take=`, `?skip=`)
- `GET /farmers/:id` (with applications, activities, assets, social capital)
- `POST /farmers`
- `PATCH /farmers/:id`
- `DELETE /farmers/:id`

### Applications
- `GET /applications` (supports `?status=`, `?farmerId=`, `?take=`, `?skip=`)
- `GET /applications/:id` (with farmer, scores, satellite, audit logs)
- `POST /applications`
- `PATCH /applications/:id/status`

### Readiness & assessment
- `GET /applications/:applicationId/readiness`
- `GET /applications/:applicationId/assessment-summary` — one payload for the operator UI
- `GET /districts` — reference district list (environment autofill)
- `POST /applications/:applicationId/environment/autofill` / `confirm` / `PATCH .../environment`

### Scoring
- `POST /applications/:applicationId/score` — **runs the model**
- `GET /scores` (supports `?riskBand=`)
- `GET /scores/:id`

### Supporting records
- `POST /farm-activities`
- `POST /assets`
- `POST /social-capital`
- `POST /household-income`
- `POST /satellite-data`
- `POST /users`
- `GET /audit-logs`
- `POST /audit-logs`

### Health
- `GET /api/health` — returns backend status + inference-service health

## Scoring workflow (the heart of Objective 2)

File: `backend/src/services/scoringService.js`

```
POST /api/applications/:id/score
        │
        ▼
1.  Load application with farmer + latest activity / social / satellite rows   (Prisma)
2.  Build the 161-feature dictionary (names from `artifacts/output/feature_columns.json`)   (featureBuilder.js)
3.  POST to the Python inference service                                       (inferenceClient.js)
4.  Persist the response in credit_scores                                      (Prisma)
5.  Update loan_applications.status = 'SCORED'                                 (Prisma)
6.  Write an audit_logs entry (action = APPLICATION_SCORED)                    (auditService.js)
7.  Return JSON with { score, prediction, application }
```

`featureBuilder.js` is the bridge between *what loan officers can realistically fill in* and the **161** model input columns in `feature_columns.json`. Any column not set here is sent as `null` and the trained sklearn imputers in the joblib `Pipeline` fill it — matching training behaviour; the Python response lists `imputed_features` for transparency.

## Validation & robustness

- Every POST/PATCH validated with **Zod schemas** in `routes/`.
- `express-async-errors` + a central `errorHandler` guarantees no raw 500 crashes.
- Validation failures return `{ error: { message, details } }` with `400`.
- Inference failures surface as `502` with a clear message.
- All scoring events are audit-logged with the model version used.

## How Node talks to the Python service

`backend/src/services/inferenceClient.js` uses **axios** with a 20 s timeout to POST to `INFERENCE_SERVICE_URL` (default `http://localhost:8000`). Errors from the Python side are re-wrapped with an HTTP-friendly status code before reaching the central error handler.

## Example flow

```bash
# 1. Create a farmer
curl -X POST http://localhost:4000/api/farmers \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Tendai Moyo","district":"Murehwa","farmSizeHa":3.2}'

# 2. Create a loan application
curl -X POST http://localhost:4000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"farmerId":"<FARMER_ID>","amountRequested":1500,"purpose":"Seed and fertilizer inputs","season":"2025/2026"}'

# 3. Score it
curl -X POST http://localhost:4000/api/applications/<APP_ID>/score
```

## Presentation soundbite

> "Objective 2 required an API-based credit-scoring service. Here it is: a Node/Express backend with a 9-table PostgreSQL schema, REST endpoints for every entity, and a scoring orchestrator that takes a loan application, asks the Python inference service for a prediction, persists the result, and writes an audit log — all in one request."

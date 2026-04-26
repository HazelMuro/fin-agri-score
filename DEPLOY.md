# Fin-Agri Score — Auth & deployment (P9)

## Authentication (JWT)

- **Local demo (open API):** leave `JWT_SECRET` unset or shorter than 16 characters in `backend/.env`. The API accepts requests without `Authorization` and `GET /api/auth/me` returns `{ "auth": "disabled" }`.
- **Secured mode:** set `JWT_SECRET` to a random string of **at least 16 characters**. All routes under `/api` except `/api/health` and `POST /api/auth/login` then require:
  - `Authorization: Bearer <token>`
- **Production:** `NODE_ENV=production` **requires** a valid `JWT_SECRET` (≥16 chars) or the process exits on startup.
- **Demo accounts** (after `npm run seed` in `backend/`):
  - `loan.officer` / `officer123` — `LOAN_OFFICER`
  - `admin` / `admin123` — `ADMIN`

The React app stores the token in `localStorage` (`finagri_access_token`), attaches it on every Axios request, and redirects to `/login` on `401` (except during session bootstrap on `/auth/me`).

## Docker Compose (full stack)

From the **`fin-agri-score/`** repository root:

```bash
docker compose up --build
```

By default the API points **`INFERENCE_SERVICE_URL`** at **`http://host.docker.internal:8000`** so you can run the Python service on the host (same as the `.bat` scripts). To run inference **inside** Compose (requires model files under `./artifacts/model/`), add next to `docker-compose.yml` a `.env` file containing `INFERENCE_SERVICE_URL=http://inference:8000`, then:

```bash
docker compose --profile inference up --build
```

Services:

| Service    | Port (host) | Notes |
|-----------|---------------|--------|
| `web`     | **8080**      | Static UI (nginx). Build arg `VITE_API_BASE_URL` defaults to `http://localhost:4000` so the **browser** calls the API on the host. |
| `api`     | **4000**      | Node API; runs `prisma migrate deploy` on start. |
| `db`      | **5432**      | PostgreSQL 16. |
| `inference` | **8000**    | Optional (`--profile inference`). Python FastAPI; mount **model files** at `./artifacts/model` (`final_farmer_credit_model.joblib`, encoder, `feature_columns.json`, `model_metadata.json`). |

**First-time database content:**

```bash
docker compose run --rm api sh -c "npm run seed"
```

**Strong JWT in production** — set before `up`:

```bash
set JWT_SECRET=your-long-random-secret-at-least-16-chars
docker compose up --build
```

(On Unix: `export JWT_SECRET=...`.)

**XAI artifact CSV/JSON** for the dashboard are read from `./artifacts/output` (mounted read-only at `/artifacts` in the API container). Place Objective 1 outputs there or adjust `ARTIFACTS_DIR`.

## Manual production deploy (no Docker)

1. Build PostgreSQL and set `DATABASE_URL`.
2. `cd backend && npm ci --omit=dev && npx prisma migrate deploy && npm start` with `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`, `INFERENCE_SERVICE_URL`, `ARTIFACTS_DIR`.
3. `cd frontend && npm ci && VITE_API_BASE_URL=https://your-api.example.com npm run build` — serve `dist/` with any static host and SPA fallback to `index.html`.
4. Run inference with `uvicorn` and set `MODEL_DIR` to the trained artifact directory.

## Health checks

- API: `GET http://localhost:4000/api/health`
- Inference: `GET http://localhost:8000/health`

## Tests

```bash
cd backend
npm test
```

With `JWT_SECRET` (≥16) set, report tests obtain a token via `POST /api/auth/login` using the seeded loan officer. Ensure `npm run seed` has been executed at least once on that database.

# Objective 3 Mapping — Interactive XAI Dashboard

## What Objective 3 required

> An interactive, explainability-enabled dashboard that exposes the scoring service to a non-technical loan officer — with clear score presentation, plain-English explanations, and environmental insights.

## What was built

A **React + Vite** single-page app (`frontend/`) with a bank-ready design system and eight distinct user flows mapped onto seven navigable pages (explanation and environmental insights are panels, not separate top-level pages, to keep navigation simple for non-technical users).

## Pages (one-to-one with the brief)

| # | Page | File | Purpose |
|---|---|---|---|
| 1 | Dashboard Home | `pages/DashboardPage.jsx` | KPIs, risk distribution, recent applications, recent score activity |
| 2 | Farmers | `pages/FarmersPage.jsx` | Register, search, list farmers |
| 2a | Farmer Detail | `pages/FarmerDetailPage.jsx` | Profile + related applications + activities + social capital |
| 3 | Applications | `pages/ApplicationsPage.jsx` | Create, filter, list applications with readiness-state chips |
| 3a | Application Detail | `pages/ApplicationDetailPage.jsx` | Full record + score + explanation + environment + audit trail |
| 4 | Score Application | `pages/ScoreApplicationPage.jsx` | Pick an application, run the model, see the result |
| 5-6 | Explainability + Environmental | `components/ExplanationPanel.jsx`, `components/EnvironmentalMetrics.jsx` | Embedded panels shown on Score + App Detail pages |
| 7 | Score History | `pages/HistoryPage.jsx` | Every scoring run with search, risk filter, and sort |

## Reusable components

| Component | File | Responsibility |
|---|---|---|
| Sidebar + Topbar | `layouts/AppLayout.jsx` | Navigation, product identity |
| `SummaryCard` | `components/SummaryCard.jsx` | KPI tile used on the dashboard |
| `ScoreCard` | `components/ScoreCard.jsx` | The big 300–850 Fin-Agri Score ring, risk badge, recommendation, class probabilities |
| `RiskBadge` | `components/RiskBadge.jsx` | Green/amber/red risk pill, used everywhere |
| `FarmersTable` | `components/FarmersTable.jsx` | Farmer list with avatars |
| `ApplicationsTable` | `components/ApplicationsTable.jsx` | Applications list with status, score, risk |
| `FarmerForm` | `components/FarmerForm.jsx` | Sectioned create-farmer form |
| `ApplicationForm` | `components/ApplicationForm.jsx` | Sectioned create-application form |
| `ExplanationPanel` | `components/ExplanationPanel.jsx` | SHAP-driven, plain-English "why this score" |
| `EnvironmentalMetrics` | `components/EnvironmentalMetrics.jsx` | Rainfall + NDVI + environment score cards |
| `AuditLogList` | `components/AuditLogList.jsx` | Audit trail on the application detail page |

## Design system (bank-ready)

- Palette: deep navy (`#132c46`) + agri green (`#0f4f3b`) + accent gold (`#f5d76e`) — conveys both finance and agriculture.
- Single source of truth: `src/styles/theme.css` — change a CSS variable there and the whole app re-skins.
- Typography: Inter via system fallback; consistent heading scale.
- Components use cards with subtle shadows, clean tables, rounded badges — no chart-junk.
- Risk colors are consistent everywhere: Low = green, Medium = amber, High = red.

## UX choices for non-technical users

- **Sectioned forms** — Register-farmer and new-application forms are split into numbered sections ("1 · Personal details", "2 · Location") rather than one tall form.
- **Plain-English field labels + helper text** under important inputs.
- **Prominent score visualisation** — the `ScoreCard` uses a big ring (300–850) and a coloured risk pill that can be read across a room.
- **Explanation in human language** — SHAP features are mapped through `FRIENDLY_LABELS` in the Python service, so the dashboard says "Rainfall, last 90 days (mm)" instead of `chirps_rain_90d_mm`.
- **Status, loading and empty states** everywhere — every table has a friendly empty state, every async action has a spinner, every failure shows an inline toast with an actionable message.
- **Only 5 top-level navigation items** in the sidebar — Dashboard, Farmers, Applications, Score, History.

## How the frontend talks to the backend

- Single axios instance in `src/services/api.js` with a configurable `VITE_API_BASE_URL`.
- In dev, `vite.config.js` proxies `/api/*` to `http://localhost:4000`, so CORS is a non-issue locally.
- Each entity has its own service file: `farmers.js`, `applications.js`, `scores.js`, `dashboard.js`.
- A tiny `useApi` hook wraps loading/error/data for pages.
- The frontend **never** calls the model directly — it only talks to the Node backend.

### Artifact-backed XAI API (added)

To make Objective 3 visibly depend on Objective 1 saved explanations, backend
now exposes:

- `GET /api/xai/overview`
- `GET /api/xai/feature-importance`
- `GET /api/xai/sample-explanations`
- `GET /api/xai/evaluation-summary`

These read files from `ARTIFACTS_DIR` (default `../artifacts/output`) including:
`feature_importance.csv`, `top_features.json`, `sample_shap_explanations.json`,
`evaluation_summary.json`, and `model_metadata.json`.

## Which screens support which objectives

| Feature from brief | Screen |
|---|---|
| Dashboard totals + recent table + charts | `DashboardPage` |
| Farmer CRUD | `FarmersPage`, `FarmerDetailPage` |
| Application CRUD | `ApplicationsPage`, `ApplicationDetailPage` |
| Trigger scoring | `ScoreApplicationPage` |
| View score + risk band + recommendation | `ScoreCard` on Score + Detail pages |
| Explainability / XAI | `ExplanationPanel` on Score + Detail pages |
| Environmental insights | `EnvironmentalMetrics` on Score + Detail pages |
| Application history | `HistoryPage` |
| Audit trail | `AuditLogList` on Detail page |

## Presentation soundbite

> "Objective 3 required an interactive XAI-enabled dashboard. Here it is: a polished React SPA with a dashboard, farmer and application management, a scoring page with a bank-style 300–850 score and SHAP-driven explanations in plain English, environmental cards, and a full scoring history — all talking to the Node backend, never directly to the model."

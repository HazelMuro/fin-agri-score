/**
 * CSV exports + PDF portfolio/application/farmer summaries; some endpoints gated by readiness where noted.
 */

const prisma = require('../config/prisma');
const readinessService = require('../services/readinessService');
const reportPdfService = require('../services/reportPdfService');
const dashboardController = require('./dashboardController');
const { toCsv, filenameDate, sendCsv } = require('../utils/csv');

function toMonthKey(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function lastMonthKeys(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(toMonthKey(d));
  }
  return out;
}

async function applicationsCsv(req, res) {
  const rows = await prisma.loanApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      farmer: { select: { fullName: true, district: true, province: true } },
      creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const headers = [
    'application_id',
    'farmer_id',
    'farmer_name',
    'district',
    'province',
    'amount_requested',
    'purpose',
    'season',
    'status',
    'created_at',
    'latest_fin_agri_score',
    'latest_risk_band',
    'latest_predicted_label',
  ];

  const data = rows.map((a) => {
    const s = a.creditScores?.[0];
    return [
      a.id,
      a.farmerId,
      a.farmer?.fullName || '',
      a.farmer?.district || '',
      a.farmer?.province || '',
      a.amountRequested,
      a.purpose,
      a.season || '',
      a.status,
      a.createdAt?.toISOString?.() || '',
      s?.finAgriScore ?? '',
      s?.riskBand ?? '',
      s?.predictedLabel ?? '',
    ];
  });

  sendCsv(res, { filename: filenameDate('finagri-applications'), csv: toCsv(headers, data) });
}

async function scoreHistoryCsv(req, res) {
  const rows = await prisma.creditScore.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      application: {
        include: {
          farmer: { select: { fullName: true, district: true } },
        },
      },
    },
  });

  const headers = [
    'score_id',
    'application_id',
    'farmer_name',
    'district',
    'purpose',
    'fin_agri_score',
    'risk_band',
    'predicted_label',
    'repayment_probability',
    'recommendation',
    'model_version',
    'created_at',
  ];

  const data = rows.map((s) => [
    s.id,
    s.applicationId,
    s.application?.farmer?.fullName || '',
    s.application?.farmer?.district || '',
    s.application?.purpose || '',
    s.finAgriScore,
    s.riskBand,
    s.predictedLabel,
    s.repaymentProbability,
    s.recommendation || '',
    s.modelVersion || '',
    s.createdAt?.toISOString?.() || '',
  ]);

  sendCsv(res, { filename: filenameDate('finagri-score-history'), csv: toCsv(headers, data) });
}

async function farmersCsv(req, res) {
  const rows = await prisma.farmer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      _count: { select: { applications: true } },
      householdIncome: { select: { id: true } },
      farmActivities: { select: { id: true }, take: 1 },
      socialCapital: { select: { id: true }, take: 1 },
    },
  });

  const headers = [
    'farmer_id',
    'full_name',
    'gender',
    'age',
    'province',
    'district',
    'ward',
    'farm_size_ha',
    'phone',
    'education',
    'household_size',
    'marital_status',
    'application_count',
    'has_household_income',
    'has_farm_activity',
    'has_social_capital',
    'created_at',
  ];

  const data = rows.map((f) => [
    f.id,
    f.fullName,
    f.gender || '',
    f.age ?? '',
    f.province || '',
    f.district || '',
    f.ward || '',
    f.farmSizeHa ?? '',
    f.phone || '',
    f.education || '',
    f.householdSize ?? '',
    f.maritalStatus || '',
    f._count.applications,
    f.householdIncome ? 'yes' : 'no',
    f.farmActivities?.length ? 'yes' : 'no',
    f.socialCapital?.length ? 'yes' : 'no',
    f.createdAt?.toISOString?.() || '',
  ]);

  sendCsv(res, { filename: filenameDate('finagri-farmers'), csv: toCsv(headers, data) });
}

async function monthlySummaryCsv(req, res) {
  const keys = lastMonthKeys(12);
  const start = new Date(`${keys[0]}-01T00:00:00.000Z`);

  const [apps, scores] = await Promise.all([
    prisma.loanApplication.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.creditScore.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, riskBand: true },
    }),
  ]);

  const agg = Object.fromEntries(keys.map((k) => [k, { applications: 0, scored: 0, low: 0, medium: 0, high: 0 }]));
  apps.forEach((r) => {
    const k = toMonthKey(r.createdAt);
    if (agg[k]) agg[k].applications += 1;
  });
  scores.forEach((r) => {
    const k = toMonthKey(r.createdAt);
    if (!agg[k]) return;
    agg[k].scored += 1;
    if (r.riskBand === 'Low') agg[k].low += 1;
    else if (r.riskBand === 'Medium') agg[k].medium += 1;
    else if (r.riskBand === 'High') agg[k].high += 1;
  });

  const headers = [
    'month',
    'applications_created',
    'scores_created',
    'scores_low_risk',
    'scores_medium_risk',
    'scores_high_risk',
  ];
  const data = keys.map((k) => [
    k,
    agg[k].applications,
    agg[k].scored,
    agg[k].low,
    agg[k].medium,
    agg[k].high,
  ]);

  sendCsv(res, { filename: filenameDate('finagri-monthly-summary'), csv: toCsv(headers, data) });
}

async function applicationSummaryCsv(req, res) {
  const { id } = req.params;
  const app = await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      farmer: true,
      creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      satelliteData: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!app) return res.status(404).json({ error: { message: 'Application not found' } });

  const s = app.creditScores?.[0];
  const sat = app.satelliteData?.[0];
  const headers = [
    'application_id',
    'farmer_id',
    'farmer_name',
    'district',
    'amount_requested',
    'purpose',
    'season',
    'status',
    'application_created_at',
    'score_fin_agri',
    'score_risk_band',
    'score_predicted_label',
    'score_repayment_probability',
    'score_model_version',
    'score_created_at',
    'env_rainfall_30d_mm',
    'env_rainfall_90d_mm',
    'env_ndvi_mean',
    'env_ndvi_std',
    'env_confirmed_at',
  ];
  const row = [
    app.id,
    app.farmerId,
    app.farmer?.fullName || '',
    app.farmer?.district || '',
    app.amountRequested,
    app.purpose,
    app.season || '',
    app.status,
    app.createdAt?.toISOString?.() || '',
    s?.finAgriScore ?? '',
    s?.riskBand ?? '',
    s?.predictedLabel ?? '',
    s?.repaymentProbability ?? '',
    s?.modelVersion ?? '',
    s?.createdAt?.toISOString?.() || '',
    sat?.rainfall30dMm ?? '',
    sat?.rainfall90dMm ?? '',
    sat?.ndvi90dMean ?? '',
    sat?.ndvi90dStd ?? '',
    sat?.confirmedAt?.toISOString?.() || '',
  ];

  sendCsv(res, {
    filename: `finagri-application-${id.slice(0, 8)}.csv`,
    csv: toCsv(headers, [row]),
  });
}

async function farmerSummaryCsv(req, res) {
  const { id } = req.params;
  const f = await prisma.farmer.findUnique({
    where: { id },
    include: {
      _count: { select: { applications: true } },
      householdIncome: true,
      farmActivities: { orderBy: { createdAt: 'desc' }, take: 1 },
      socialCapital: { orderBy: { createdAt: 'desc' }, take: 1 },
      applications: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, purpose: true, status: true, amountRequested: true, createdAt: true },
      },
    },
  });
  if (!f) return res.status(404).json({ error: { message: 'Farmer not found' } });

  const headers = [
    'farmer_id',
    'full_name',
    'gender',
    'age',
    'province',
    'district',
    'farm_size_ha',
    'application_count',
    'has_household_income',
    'main_income_source',
    'main_income_amount',
    'crop_type',
    'group_member',
    'guarantor_available',
    'recent_application_ids',
    'created_at',
  ];

  const hi = f.householdIncome;
  const fa = f.farmActivities?.[0];
  const sc = f.socialCapital?.[0];
  const recentIds = (f.applications || []).map((a) => a.id).join(';');

  const row = [
    f.id,
    f.fullName,
    f.gender || '',
    f.age ?? '',
    f.province || '',
    f.district || '',
    f.farmSizeHa ?? '',
    f._count.applications,
    hi ? 'yes' : 'no',
    hi?.mainSource || '',
    hi?.mainAmount ?? '',
    fa?.cropType || '',
    sc ? (sc.groupMembership ? 'yes' : 'no') : '',
    sc ? (sc.guarantorAvailable ? 'yes' : 'no') : '',
    recentIds,
    f.createdAt?.toISOString?.() || '',
  ];

  sendCsv(res, {
    filename: `finagri-farmer-${id.slice(0, 8)}.csv`,
    csv: toCsv(headers, [row]),
  });
}

async function applicationSummaryPdf(req, res) {
  const { id } = req.params;
  const [app, readiness] = await Promise.all([
    prisma.loanApplication.findUnique({
      where: { id },
      include: {
        farmer: true,
        creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
        satelliteData: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    readinessService.evaluate(id).catch(() => null),
  ]);
  if (!app) return res.status(404).json({ error: { message: 'Application not found' } });
  reportPdfService.applicationSummaryPdf(res, { app, readiness });
}

async function farmerSummaryPdf(req, res) {
  const { id } = req.params;
  const farmer = await prisma.farmer.findUnique({
    where: { id },
    include: {
      householdIncome: true,
      farmActivities: { orderBy: { createdAt: 'desc' }, take: 1 },
      socialCapital: { orderBy: { createdAt: 'desc' }, take: 1 },
      applications: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { id: true, purpose: true, status: true, amountRequested: true, createdAt: true },
      },
    },
  });
  if (!farmer) return res.status(404).json({ error: { message: 'Farmer not found' } });
  reportPdfService.farmerSummaryPdf(res, { farmer });
}

async function portfolioSummaryPdf(req, res) {
  const data = await dashboardController.getOverviewPayload();
  reportPdfService.portfolioSummaryPdf(res, data);
}

async function auditLogsCsv(req, res) {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: {
      application: { select: { purpose: true, farmerId: true } },
    },
  });

  const headers = ['log_id', 'created_at', 'action', 'application_id', 'purpose', 'user_id', 'details_json'];
  const data = rows.map((l) => [
    l.id,
    l.createdAt?.toISOString?.() || '',
    l.action,
    l.applicationId || '',
    l.application?.purpose || '',
    l.userId || '',
    l.details != null ? JSON.stringify(l.details) : '',
  ]);

  sendCsv(res, { filename: filenameDate('finagri-audit-log'), csv: toCsv(headers, data) });
}

module.exports = {
  applicationsCsv,
  scoreHistoryCsv,
  farmersCsv,
  monthlySummaryCsv,
  applicationSummaryCsv,
  farmerSummaryCsv,
  applicationSummaryPdf,
  farmerSummaryPdf,
  portfolioSummaryPdf,
  auditLogsCsv,
};

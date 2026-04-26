const prisma = require('../config/prisma');

function toMonthKey(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
  });
}

function lastMonthsKeys(count = 6) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(toMonthKey(d));
  }
  return out;
}

/**
 * Portfolio snapshot (dashboard API + PDF export). Kept in one place so metrics stay aligned.
 */
async function getOverviewPayload() {
  const monthKeys = lastMonthsKeys(6);
  const start = new Date(`${monthKeys[0]}-01T00:00:00.000Z`);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  const [
    totalFarmers,
    totalApplications,
    totalScoreRecords,
    avgScoreAgg,
    lowCount,
    mediumCount,
    highCount,
    recentApplicationsRaw,
    pendingApplications,
    unscoredApplications,
    recentlySubmittedApplications,
    monthlyApplicationsRaw,
    monthlyScoresRaw,
    highRiskRecent,
  ] = await Promise.all([
    prisma.farmer.count(),
    prisma.loanApplication.count(),
    prisma.creditScore.count(),
    prisma.creditScore.aggregate({ _avg: { finAgriScore: true } }),
    prisma.creditScore.count({ where: { riskBand: 'Low' } }),
    prisma.creditScore.count({ where: { riskBand: 'Medium' } }),
    prisma.creditScore.count({ where: { riskBand: 'High' } }),
    prisma.loanApplication.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        farmer: { select: { id: true, fullName: true, district: true } },
        creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.loanApplication.count({ where: { status: 'PENDING' } }),
    prisma.loanApplication.count({ where: { creditScores: { none: {} } } }),
    prisma.loanApplication.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.loanApplication.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.creditScore.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.creditScore.count({
      where: {
        riskBand: 'High',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const recentApplications = recentApplicationsRaw.map((a) => ({
    id: a.id,
    farmerId: a.farmerId,
    farmerName: a.farmer?.fullName || '—',
    district: a.farmer?.district || '—',
    amountRequested: a.amountRequested,
    purpose: a.purpose,
    status: a.status,
    createdAt: a.createdAt,
    finAgriScore: a.creditScores?.[0]?.finAgriScore ?? null,
    riskBand: a.creditScores?.[0]?.riskBand ?? null,
  }));

  const monthAgg = Object.fromEntries(
    monthKeys.map((k) => [k, { applications: 0, scored: 0 }])
  );
  monthlyApplicationsRaw.forEach((r) => {
    const key = toMonthKey(r.createdAt);
    if (monthAgg[key]) monthAgg[key].applications += 1;
  });
  monthlyScoresRaw.forEach((r) => {
    const key = toMonthKey(r.createdAt);
    if (monthAgg[key]) monthAgg[key].scored += 1;
  });
  const monthlyTrend = monthKeys.map((key) => ({
    month: monthLabelFromKey(key),
    applications: monthAgg[key].applications,
    scored: monthAgg[key].scored,
  }));

  return {
    totals: {
      farmers: totalFarmers,
      applications: totalApplications,
      scoredApplications: totalScoreRecords,
      avgFinAgriScore: Math.round(avgScoreAgg._avg.finAgriScore || 0),
    },
    riskDistribution: {
      Low: lowCount,
      Medium: mediumCount,
      High: highCount,
    },
    recentApplications,
    monthlyTrend,
    attention: {
      pendingApplications,
      unscoredApplications,
      highRiskRecent,
      recentlySubmittedApplications,
    },
  };
}

async function overview(req, res) {
  res.json(await getOverviewPayload());
}

async function scoreHistory(req, res) {
  const { take = 25 } = req.query;
  const items = await prisma.creditScore.findMany({
    take: Number(take),
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        include: {
          farmer: { select: { fullName: true, district: true } },
        },
      },
    },
  });
  res.json({ items });
}

module.exports = { overview, scoreHistory, getOverviewPayload };

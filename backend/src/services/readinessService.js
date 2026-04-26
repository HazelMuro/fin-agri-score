/**
 * Readiness / data-quality evaluator.
 *
 * Returns two separate concepts for each application:
 *
 *   completeness   - pure field presence (%) — "is something there?"
 *   confidence     - weighted by data provenance (%)
 *                    user-entered          1.0
 *                    user_confirmed        0.95
 *                    derived               0.9
 *                    autofill_live         0.75
 *                    autofill_fallback     0.55
 *                    default               0.3
 *                    missing               0.0
 *   state          - one of:
 *                    incomplete             required fields missing
 *                    needs_review           completeness OK but autofilled env not confirmed
 *                    ready_with_warnings    scorable but confidence < threshold or warnings present
 *                    ready_to_score         scorable and confident
 *                    scored                 application already has a recent score
 *
 * The score endpoint refuses to run unless state ∈ {ready_with_warnings, ready_to_score}
 * (configurable via READINESS_ALLOW_WARNINGS). `needs_review` and `incomplete`
 * always block.
 */

const prisma = require('../config/prisma');

const CONFIDENCE_WEIGHTS = {
  user: 1.0,
  user_confirmed: 0.95,
  derived: 0.9,
  derived_from_rainfall: 0.85,
  autofill_live: 0.75,
  autofill: 0.7,
  autofill_fallback: 0.55,
  edited: 1.0,
  default: 0.3,
  missing: 0.0,
};

const ALLOW_WARNINGS =
  (process.env.READINESS_ALLOW_WARNINGS || 'true').toLowerCase() !== 'false';
const CONFIDENCE_WARN_THRESHOLD = Number(
  process.env.READINESS_CONFIDENCE_WARN_THRESHOLD || 75
);

function hasValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function fieldEntry(label, value, provenance, { required = true } = {}) {
  return {
    label,
    present: hasValue(value),
    value: hasValue(value) ? value : null,
    provenance,
    weight: CONFIDENCE_WEIGHTS[provenance] ?? 0,
    required,
  };
}

function sectionAggregate(label, fields, opts = {}) {
  const requiredFields = fields.filter((f) => f.required !== false);
  const basis = requiredFields.length ? requiredFields : fields;
  const total = basis.length || 1;
  const confidenceTotal = fields.length || 1;
  const present = basis.filter((f) => f.present).length;
  const completeness = Math.round((present / total) * 100);
  const confidence = Math.round(
    (fields.reduce((a, f) => a + (f.present ? f.weight : 0), 0) / confidenceTotal) * 100
  );
  return {
    label,
    completeness,
    confidence,
    fields,
    missing: basis.filter((f) => !f.present).map((f) => f.label),
    note: opts.note || null,
  };
}

async function evaluate(applicationId) {
  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      farmer: { include: { householdIncome: true } },
      satelliteData: { orderBy: { createdAt: 'desc' }, take: 1 },
      creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!app) {
    const err = new Error(`Application not found: ${applicationId}`);
    err.statusCode = 404;
    throw err;
  }

  const [activity, social] = await Promise.all([
    prisma.farmActivity.findFirst({
      where: { farmerId: app.farmerId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.socialCapital.findFirst({
      where: { farmerId: app.farmerId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const satellite = app.satelliteData[0] || null;

  const farmer = sectionAggregate('Farmer profile', [
    fieldEntry('Full name', app.farmer.fullName, app.farmer.fullName ? 'user' : 'missing'),
    fieldEntry('Gender', app.farmer.gender, app.farmer.gender ? 'user' : 'missing'),
    fieldEntry('Age', app.farmer.age, app.farmer.age != null ? 'user' : 'missing'),
    fieldEntry('Province', app.farmer.province, app.farmer.province ? 'user' : 'missing'),
    fieldEntry('District', app.farmer.district, app.farmer.district ? 'user' : 'missing'),
    fieldEntry('Farm size (ha)', app.farmer.farmSizeHa, app.farmer.farmSizeHa != null ? 'user' : 'missing'),
    fieldEntry('Education', app.farmer.education, app.farmer.education ? 'user' : 'missing'),
    fieldEntry('Household size', app.farmer.householdSize, app.farmer.householdSize != null ? 'user' : 'missing'),
  ]);

  const loan = sectionAggregate('Loan details', [
    fieldEntry('Amount requested', app.amountRequested, app.amountRequested != null ? 'user' : 'missing'),
    fieldEntry('Purpose', app.purpose, app.purpose ? 'user' : 'missing'),
    fieldEntry('Season', app.season, app.season ? 'user' : 'missing'),
  ]);

  const h = app.farmer.householdIncome;
  const household = sectionAggregate('Household income', [
    fieldEntry('Main source', h?.mainSource, h?.mainSource ? 'user' : 'missing'),
    fieldEntry('Main amount', h?.mainAmount, h?.mainAmount != null ? 'user' : 'missing'),
    fieldEntry('Secondary source', h?.secondarySource, h?.secondarySource ? 'user' : 'missing', { required: false }),
    fieldEntry('Dietary diversity', h?.dietaryDiversity, h?.dietaryDiversity != null ? 'user' : 'missing', { required: false }),
    fieldEntry('Coping index', h?.copingIndex, h?.copingIndex != null ? 'user' : 'missing', { required: false }),
  ]);

  const act = sectionAggregate('Farm activity', [
    fieldEntry('Main crop', activity?.cropType, activity?.cropType ? 'user' : 'missing'),
    fieldEntry('Estimated yield', activity?.estimatedYield, activity?.estimatedYield != null ? 'user' : 'missing'),
    fieldEntry('Irrigation', activity?.irrigation, activity?.irrigation ? 'user' : 'missing'),
    fieldEntry('Input usage', activity?.inputUsage, activity?.inputUsage ? 'user' : 'missing'),
  ]);

  const socialSec = sectionAggregate('Social capital', [
    fieldEntry('Group membership', social ? social.groupMembership : null, social ? 'user' : 'missing'),
    fieldEntry('Guarantor', social ? social.guarantorAvailable : null, social ? 'user' : 'missing'),
    fieldEntry(
      'Group name',
      social?.groupName,
      social?.groupName ? 'user' : 'missing',
      { required: !!social?.groupMembership }
    ),
  ]);

  const envFieldProv = (field) => {
    if (!satellite || satellite[field] == null) return 'missing';
    const pf = satellite.provenance?.[field];
    if (pf) return pf;
    if (satellite.confirmedAt) return 'user_confirmed';
    if (satellite.sourceKind === 'user' || satellite.sourceKind === 'edited') return 'user';
    if (satellite.sourceKind === 'fallback') return 'autofill_fallback';
    if (satellite.sourceKind === 'live') return 'autofill_live';
    return 'autofill';
  };

  const envFields = [
    fieldEntry('Rainfall (30-day)', satellite?.rainfall30dMm, envFieldProv('rainfall30dMm')),
    fieldEntry('Rainfall (90-day)', satellite?.rainfall90dMm, envFieldProv('rainfall90dMm')),
    fieldEntry('NDVI mean', satellite?.ndvi90dMean, envFieldProv('ndvi90dMean')),
    fieldEntry('Environmental score', satellite?.environmentScore, envFieldProv('environmentScore')),
    fieldEntry('Environmental risk', satellite?.environmentRisk, envFieldProv('environmentRisk')),
  ];
  const envNote = !satellite
    ? 'Environmental data not loaded — run autofill from the Environmental step.'
    : !satellite.confirmedAt && (satellite.sourceKind === 'live' || satellite.sourceKind === 'fallback')
    ? 'Auto-filled values are awaiting officer confirmation.'
    : satellite.confirmedAt
    ? `Confirmed by officer on ${new Date(satellite.confirmedAt).toLocaleString()}`
    : null;
  const environment = sectionAggregate('Environmental data', envFields, { note: envNote });

  const sections = { farmer, loan, household, activity: act, social: socialSec, environment };

  const totals = Object.values(sections);
  const completeness = Math.round(
    totals.reduce((a, s) => a + s.completeness, 0) / totals.length
  );
  const confidence = Math.round(
    totals.reduce((a, s) => a + s.confidence, 0) / totals.length
  );

  const warnings = [];
  const blocking = [];
  totals.forEach((s) => {
    if (s.completeness < 100) blocking.push(s.label);
  });

  const envUnconfirmed =
    satellite &&
    !satellite.confirmedAt &&
    (satellite.sourceKind === 'live' || satellite.sourceKind === 'fallback');
  if (envUnconfirmed) {
    warnings.push(
      'Environmental data was auto-filled from ' +
        (satellite.sourceKind === 'fallback'
          ? 'district climatology (offline fallback)'
          : 'NASA POWER (live)') +
        ' and has not been confirmed by the officer yet.'
    );
  }

  if (satellite?.sourceKind === 'fallback') {
    warnings.push(
      'Live weather service (NASA POWER) was unreachable; values come from district climatology. Treat as a provisional estimate.'
    );
  }

  if (confidence < CONFIDENCE_WARN_THRESHOLD) {
    warnings.push(
      `Overall data confidence is ${confidence}%. Key inputs look thin — review before scoring.`
    );
  }

  const alreadyScored = app.creditScores.length > 0;

  let state;
  if (blocking.length > 0) {
    state = 'incomplete';
  } else if (envUnconfirmed) {
    state = 'needs_review';
  } else if (alreadyScored) {
    state = 'scored';
  } else if (warnings.length > 0 || confidence < CONFIDENCE_WARN_THRESHOLD) {
    state = 'ready_with_warnings';
  } else {
    state = 'ready_to_score';
  }

  const canScore =
    state === 'ready_to_score' ||
    (state === 'ready_with_warnings' && ALLOW_WARNINGS) ||
    state === 'scored';

  return {
    applicationId,
    state,
    canScore,
    completeness,
    confidence,
    sections,
    blocking,
    warnings,
    lastScoreId: app.creditScores[0]?.id || null,
    lastScoreAt: app.creditScores[0]?.createdAt || null,
  };
}

module.exports = { evaluate, CONFIDENCE_WEIGHTS };

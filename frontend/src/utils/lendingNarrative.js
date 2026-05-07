/**
 * Presents the model outcome in committee-friendly language (named farmer when provided).
 * Does not change model behaviour — display layer only.
 */

const SHORT_LABELS = {
  // Income
  income_main_amount: 'Monthly Farm Revenue',
  income_main: 'Main Income Source',
  income_diversity: 'Income Diversity',
  has_sec_income: 'Other Income Streams',
  income_sec_amount: 'Secondary Revenue',
  tot_income: 'Total Monthly Income',
  income_source_count: 'Income Streams',
  income_primary_share: 'Income Concentration',
  // Demographics
  hh_education: 'Education Level',
  hh_gender: 'Household Head Gender',
  hh_size: 'Household Size',
  resp_age: 'Applicant Age',
  resp_gender: 'Applicant Gender',
  // Farm
  crp_main: 'Primary Crop Type',
  crp_landsize: 'Farm Scale',
  crp_irrigation: 'Irrigation Access',
  crp_proddif: 'Production Stability',
  crp_harv_change: 'Harvest Change',
  crp_area_change: 'Land Area Change',
  // Environmental
  chirps_rain_30d_mm: 'Recent Rainfall (30 days)',
  chirps_rain_90d_mm: 'Seasonal Rainfall (90 days)',
  modis_ndvi_90d_mean: 'Crop Health Index',
  modis_ndvi_90d_std: 'Crop Growth Stability',
  environment_score: 'Environmental Resilience',
  environment_risk: 'Agro-Climate Risk',
  // Other
  need_loans: 'Stated Need for Credit',
  ls_num_now: 'Current Livestock Count',
  ls_pct_change: 'Livestock Herd Change',
  shock_count: 'Total Household Shocks',
  shock_noshock: 'No Recent Shocks',
  hdds_score: 'Dietary Diversity (Liquidity)',
  lcsi: 'Household Stress Level',
};

function label(f) {
  if (!f) return '';
  const short = SHORT_LABELS[f.feature];
  if (short) return short;
  return (f.label || f.feature || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {object} prediction - score API payload (or reconstructed from DB row)
 * @param {object} meta - assessment meta (confidence, coverage)
 * @param {{ farmerName?: string, loanPurpose?: string }} [context]
 * @returns {object} Narrative fields for ScoreCard / committee view
 */
export function buildLendingNarrative(prediction, meta = {}, context = {}) {
  const farmerLabel = String(context.farmerName || '').trim() || 'This applicant';
  const loanPurpose = String(context.loanPurpose || '').trim();
  const purposePhrase = loanPurpose ? ` for “${loanPurpose}”` : '';

  const band = String(prediction?.risk_band || '').trim();
  const scoreVal = prediction?.fin_agri_score;
  const scoreBit =
    scoreVal != null && Number.isFinite(Number(scoreVal)) ? ` (Fin‑Agri Score ${Math.round(Number(scoreVal))})` : '';

  const dataConfidence = meta?.dataConfidence ?? 100;
  const featureCoverage = (meta?.featureCoverage ?? 1) * 100;
  const isPartialData = dataConfidence < 70 || featureCoverage < 80;

  const factors = Array.isArray(prediction?.top_factors) ? prediction.top_factors : [];
  const increasing = factors
    .filter((f) => f.direction === 'increases_risk')
    .slice(0, 4)
    .map((f) => label(f).trim())
    .filter(Boolean);
  const reducing = factors
    .filter((f) => f.direction === 'reduces_risk')
    .slice(0, 3)
    .map((f) => label(f).trim())
    .filter(Boolean);

  let decision = '';
  if (band === 'Low') {
    decision = 'Favourable — standard approval is reasonable subject to your institution’s policy checks.';
  } else if (band === 'Medium') {
    decision = 'Conditional — we can work this case, but it needs mitigants and a closer look before a final “yes.”';
  } else {
    decision = 'High risk on this model — we would not put this on standard terms without extra structure or a manual review.';
  }

  const riskDriversFallback =
    increasing.length > 0
      ? increasing
      : ['General risk profile based on current regional benchmarks and limited historical data.'];

  let why = '';
  if (band === 'High') {
    why = `We would not be comfortable with a straight approval because ${increasing.length ? `the case is being pulled down especially by: ${increasing.join('; ')}.` : 'several model inputs point to elevated credit risk (see the driver list).'}`;
  } else if (band === 'Medium') {
    why = `This sits in the “proceed with care” range: ${increasing.length ? `pressure from ${increasing.join('; ')}` : 'there is a mix of support and risk signals'}. ${
      reducing.length ? `On the positive side, ${reducing.join('; ')} help the story.` : ''
    }`;
  } else {
    why = reducing.length
      ? `The file looks comparatively strong, with support from: ${reducing.join('; ')}.`
      : 'The overall pattern is closer to a lower-risk profile than a stressed one, subject to your checks.';
  }

  const nextSteps =
    band === 'Low'
      ? [
          'Complete policy KYC and document the approval decision in your loan file.',
          'Use Reports to export the committee pack if the paper trail is required.',
        ]
      : band === 'Medium'
        ? [
            'List concrete mitigants: guarantor, lower amount, in-kind input, or staged disbursement.',
            'Have the officer re-confirm revenue streams and the coming season production plan with the household.',
            'Re-run Fin-Agri if you change material facts, then re-present to the committee.',
          ]
        : [
            'Send to manual underwriting or prepare a decline / referral, per your credit policy.',
            'If you still want to lend, start with a smaller pilot or stronger collateral, then rescope.',
            'Strengthen the file (revenue, group support, season outlook) and re-apply when realistic.',
          ];

  /** Short headline shown at top of score card — names the farmer when known */
  let headline = '';
  if (band === 'Low') {
    headline = `${farmerLabel}${purposePhrase}${scoreBit}: lower model risk — favourable for standard processing subject to policy.`;
  } else if (band === 'Medium') {
    headline = `${farmerLabel}${purposePhrase}${scoreBit}: medium model risk — do not close on vanilla terms without mitigants.`;
  } else {
    headline = `${farmerLabel}${purposePhrase}${scoreBit}: high model risk — we would not recommend standard unsecured terms without manual review or decline.`;
  }

  /** Long-form “because” tying name + drivers */
  const nameBit =
    farmerLabel === 'This applicant' ? 'This applicant’s loan application' : `${farmerLabel}’s loan application`;

  let personalizedExplanation = '';
  if (band === 'High') {
    personalizedExplanation = increasing.length
      ? `For ${nameBit}${purposePhrase}, the model indicates higher risk primarily due to ${increasing.join(', ')}.`
      : `For ${nameBit}${purposePhrase}, several inputs combine into a stressed profile — treat with caution.`;
    if (reducing.length) {
      personalizedExplanation += ` Factors that partly offset this risk include ${reducing.join(', ')}.`;
    }
  } else if (band === 'Medium') {
    personalizedExplanation = increasing.length
      ? `${farmerLabel === 'This applicant' ? 'This applicant’s case' : `${farmerLabel}’s case`} sits in the “review carefully” band${purposePhrase}: notable pressure from ${increasing.join(', ')}.`
      : `${farmerLabel === 'This applicant' ? 'This applicant’s profile' : `${farmerLabel}’s profile`} mixes supportive and cautious signals — typical of conditional approval work${purposePhrase}.`;
    if (reducing.length) {
      personalizedExplanation += ` Supporting angles include ${reducing.join(', ')}.`;
    }
  } else {
    personalizedExplanation = reducing.length
      ? `${farmerLabel === 'This applicant' ? 'This applicant’s file' : `${farmerLabel}’s file`} compares favourably on ${reducing.join(', ')}${purposePhrase}.`
      : `${farmerLabel === 'This applicant' ? 'This applicant’s overall pattern' : `${farmerLabel}’s overall pattern`} aligns more closely with lower model risk than with severe stress${purposePhrase}.`;
  }

  if (isPartialData) {
    personalizedExplanation += ` [ETHICAL NOTE: This decision is based on partial data (${Math.round(featureCoverage)}% coverage) and may change with more complete information.]`;
  }

  const backendRec = String(prediction?.recommendation || '').trim();

  return {
    farmerLabel,
    headline,
    personalizedExplanation: personalizedExplanation.replace(/\s+/g, ' ').trim(),
    decision,
    why: why.replace(/\s+/g, ' ').trim(),
    riskDrivers: increasing.length ? increasing : riskDriversFallback,
    strengths: reducing,
    nextSteps,
    /** Official model wording from inference — shown prominently */
    backendRecommendation: backendRec || null,
  };
}

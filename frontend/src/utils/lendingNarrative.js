/**
 * Presents the model outcome in committee-friendly language.
 * Does not change model behaviour — display layer only.
 */

function label(f) {
  if (!f) return '';
  return (f.label || f.feature || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {object} prediction - score API payload (or reconstructed from DB row)
 * @returns {{ decision: string, why: string, riskDrivers: string[], strengths: string[], nextSteps: string[] }}
 */
export function buildLendingNarrative(prediction) {
  const band = String(prediction?.risk_band || '').trim();
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

  const riskDrivers = increasing.length
    ? increasing
    : ['(See “Why this score” for the main drivers the model is reacting to.)'];

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
          'Use Reports to export the committee pack if the panel needs a paper trail.',
        ]
      : band === 'Medium'
        ? [
            'List concrete mitigants: guarantor, lower amount, in-kind input, or staged disbursement.',
            'Have the officer re-confirm income and the coming season plan with the household.',
            'Re-run Fin-Agri if you change material facts, then re-present to the committee.',
          ]
        : [
            'Send to manual underwriting or prepare a decline / referral, per your credit policy.',
            'If you still want to lend, start with a smaller pilot or stronger collateral, then rescope.',
            'Strengthen the file (income, group support, season outlook) and re-apply when realistic.',
          ];

  return {
    decision,
    why: why.replace(/\s+/g, ' ').trim(),
    riskDrivers: increasing.length ? increasing : riskDrivers,
    strengths: reducing,
    nextSteps,
  };
}

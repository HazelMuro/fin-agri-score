/**
 * Six preset scored applications for demos: **two per risk band** (Low / Medium / High).
 * Each row gets **confirmed satellite-style autofill** (rainfall, NDVI, environment score/risk)
 * tuned by band so environmental narrative matches the seeded band.
 *
 * **Scoring:** After data is inserted, the seed calls the same `scoreApplication(..., { force: true })`
 * path as the API (live Python inference). That persists `featuresSnapshot` so re-score behaviour
 * matches the first score. For the **two Medium demos**, `applyTrainingMediumOverlay` merges anonymised
 * survey-complete rows (`prisma/data/trainingMediumOverlays.json`) so the CatBoost argmax can be MEDIUM —
 * sparse Objective-2 forms alone rarely peak on MEDIUM (see model probe notes). Regenerate overlays with
 * `node scripts/export-medium-overlays.js` after changing demo phones.
 *
 * If inference is unreachable, the script falls back to the static `scoreRow` in each preset.
 *
 * Used by `npm run seed:risk-demos`, full `npm run seed`, and backward-compat `seedMediumBandDemos`.
 */

const scoringService = require('../src/services/scoringService');

const REC_LOW =
  'We would be comfortable with a standard credit decision, subject to your ' +
  'policy checks. Main message: the model sees this case as lower risk at this time.';

const REC_MEDIUM =
  'We would not close this on plain vanilla terms without mitigants. ' +
  'Consider guarantor, smaller ticket, staged pay, or in-kind support, ' +
  'then have the officer re-check income and the season plan before a final sign-off.';

const REC_HIGH =
  'We would not put this on standard terms without a manual review. ' +
  'Options: decline, add security, or re-scope to a smaller pilot; update the file ' +
  'and re-run when the household story is stronger.';

function recommendationForBand(band) {
  if (band === 'Low') return REC_LOW;
  if (band === 'Medium') return REC_MEDIUM;
  return REC_HIGH;
}

/**
 * Derive rainfall / NDVI / env metrics from district climatology + band tilt.
 * Low → wetter-than-normal look; High → drought stress look (demo labelling).
 */
function buildSatelliteAutofillSeed(districtProfile, band) {
  if (!districtProfile) return null;
  const tune =
    band === 'Low'
      ? { wetBias: 0.14, envScore: 76, envRisk: 'Low' }
      : band === 'Medium'
        ? { wetBias: -0.07, envScore: 51, envRisk: 'Medium' }
        : { wetBias: -0.34, envScore: 23, envRisk: 'High' };

  const wb = tune.wetBias;
  const rain30 = Math.max(0, Math.round(districtProfile.rainfall30dClimMm * (1 + wb)));
  const rain90 = Math.max(0, Math.round(districtProfile.rainfall90dClimMm * (1 + wb * 0.72)));
  const ndviMean = Math.round(
    Math.max(
      0.06,
      Math.min(0.88, districtProfile.ndviBaseline * (1 + wb * 0.5))
    ) * 1000
  ) / 1000;
  const ndviStd =
    Math.round(
      Math.max(0.03, districtProfile.ndviVariability * (1 + Math.abs(wb) * 0.35)) * 1000
    ) / 1000;

  return {
    rainfall30dMm: rain30,
    rainfall90dMm: rain90,
    rainfallAnomaly: Math.round(wb * 1000) / 1000,
    ndvi90dMean: ndviMean,
    ndvi90dStd: ndviStd,
    environmentScore: tune.envScore,
    environmentRisk: tune.envRisk,
  };
}

/** Two demos per band — distinct phones for idempotent re-seeding. */
const RISK_BAND_DEMOS = [
  // ----- Low -----
  {
    band: 'Low',
    phone: '+263 77 811 0101',
    fullName: 'Tanaka Sibanda',
    gender: 'Male',
    age: 44,
    education: 'Secondary',
    province: 'Midlands',
    district: 'Shurugwi',
    ward: 'Ward 5',
    farmSizeHa: 4.1,
    householdSize: 4,
    maritalStatus: 'Married',
    income: {
      mainSource: 'Crop farming',
      mainAmount: 3100,
      secondarySource: 'Small business',
      secondaryAmount: 950,
      shockExperienced: false,
      copingIndex: 1,
      dietaryDiversity: 10,
    },
    activity: {
      cropType: 'Tobacco',
      estimatedYield: 2.8,
      irrigation: 'Yes',
      season: '2025/2026',
      inputUsage: 'High',
    },
    social: {
      groupMembership: true,
      groupName: 'Shurugwi Tobacco Association',
      yearsInGroup: 10,
      leadershipRole: 'Member',
      guarantorAvailable: true,
    },
    loan: { amount: 3200, purpose: 'Seed and fertilizer inputs for tobacco' },
    scoreRow: {
      finAgriScore: 738,
      repaymentProbability: 0.41,
      predictedLabel: 'LOW',
      classProbabilities: { HIGH: 0.14, LOW: 0.46, MEDIUM: 0.4 },
    },
  },
  {
    band: 'Low',
    phone: '+263 77 811 0102',
    fullName: 'Brian Sibanda',
    gender: 'Male',
    age: 44,
    education: 'Secondary',
    province: 'Midlands',
    district: 'Shurugwi',
    ward: 'Ward 5',
    farmSizeHa: 4.1,
    householdSize: 4,
    maritalStatus: 'Married',
    income: {
      mainSource: 'Crop farming',
      mainAmount: 3100,
      secondarySource: 'Small business',
      secondaryAmount: 950,
      shockExperienced: false,
      copingIndex: 1,
      dietaryDiversity: 10,
    },
    activity: {
      cropType: 'Tobacco',
      estimatedYield: 2.8,
      irrigation: 'Yes',
      season: '2025/2026',
      inputUsage: 'High',
    },
    social: {
      groupMembership: true,
      groupName: 'Shurugwi Tobacco Association',
      yearsInGroup: 10,
      leadershipRole: 'Member',
      guarantorAvailable: true,
    },
    loan: { amount: 3200, purpose: 'Seed and fertilizer inputs for tobacco' },
    scoreRow: {
      finAgriScore: 712,
      repaymentProbability: 0.38,
      predictedLabel: 'LOW',
      classProbabilities: { HIGH: 0.17, LOW: 0.43, MEDIUM: 0.4 },
    },
  },

  // ----- Medium -----
  {
    band: 'Medium',
    phone: '+263 77 811 0201',
    fullName: 'Nyasha Mukonde',
    gender: 'Female',
    age: 43,
    education: 'Secondary',
    province: 'Matabeleland South',
    district: 'Matobo',
    ward: 'Ward 4',
    farmSizeHa: 3.5,
    householdSize: 5,
    maritalStatus: 'Widowed',
    income: {
      mainSource: 'Public employment',
      mainAmount: 49500,
      secondarySource: null,
      secondaryAmount: null,
      shockExperienced: false,
      copingIndex: 2,
      dietaryDiversity: 9,
    },
    activity: {
      cropType: 'Maize',
      estimatedYield: 2.6,
      irrigation: 'Partial',
      season: '2025/2026',
      inputUsage: 'Medium',
    },
    social: {
      groupMembership: true,
      groupName: 'Matobo Horticultural Group',
      yearsInGroup: 5,
      leadershipRole: 'Member',
      guarantorAvailable: true,
    },
    loan: { amount: 1650, purpose: 'Inputs and drought recovery' },
    scoreRow: {
      finAgriScore: 631,
      repaymentProbability: 0.34,
      predictedLabel: 'MEDIUM',
      classProbabilities: { HIGH: 0.29, LOW: 0.21, MEDIUM: 0.5 },
    },
  },
  {
    band: 'Medium',
    phone: '+263 77 811 0202',
    fullName: 'Simba Gwenzi',
    gender: 'Male',
    age: 39,
    education: 'Secondary',
    province: 'Mashonaland West',
    district: 'Hurungwe',
    ward: 'Ward 3',
    farmSizeHa: 4.5,
    householdSize: 6,
    maritalStatus: 'Married',
    income: {
      mainSource: 'Crop farming',
      mainAmount: 50000,
      secondarySource: null,
      secondaryAmount: null,
      shockExperienced: true,
      copingIndex: 3,
      dietaryDiversity: 8,
    },
    activity: {
      cropType: 'Maize',
      estimatedYield: 2.2,
      irrigation: 'No',
      season: '2025/2026',
      inputUsage: 'Medium',
    },
    social: {
      groupMembership: true,
      groupName: 'Hurungwe Cashcrop Trust',
      yearsInGroup: 6,
      leadershipRole: 'Treasurer',
      guarantorAvailable: true,
    },
    loan: { amount: 1300, purpose: 'Ox-drawn tillage hire' },
    scoreRow: {
      finAgriScore: 574,
      repaymentProbability: 0.26,
      predictedLabel: 'MEDIUM',
      classProbabilities: { HIGH: 0.34, LOW: 0.18, MEDIUM: 0.48 },
    },
  },

  // ----- High -----
  {
    band: 'High',
    phone: '+263 77 811 0301',
    fullName: 'Paidamoyo Chara',
    gender: 'Female',
    age: 52,
    education: 'Primary',
    province: 'Masvingo',
    district: 'Chiredzi',
    ward: 'Ward 11',
    farmSizeHa: 1.1,
    householdSize: 8,
    maritalStatus: 'Widowed',
    income: {
      mainSource: 'Casual labour',
      mainAmount: 420,
      secondarySource: null,
      secondaryAmount: null,
      shockExperienced: true,
      copingIndex: 4,
      dietaryDiversity: 4,
    },
    activity: {
      cropType: 'Maize',
      estimatedYield: 0.9,
      irrigation: 'No',
      season: '2025/2026',
      inputUsage: 'Low',
    },
    social: {
      groupMembership: false,
      groupName: null,
      yearsInGroup: null,
      leadershipRole: null,
      guarantorAvailable: false,
    },
    loan: { amount: 900, purpose: 'Emergency seed loan after livestock loss' },
    scoreRow: {
      finAgriScore: 412,
      repaymentProbability: 0.14,
      predictedLabel: 'HIGH',
      classProbabilities: { HIGH: 0.52, LOW: 0.12, MEDIUM: 0.36 },
    },
  },
  {
    band: 'High',
    phone: '+263 77 811 0302',
    fullName: 'Tinashe Masvikeni',
    gender: 'Male',
    age: 29,
    education: 'Secondary',
    province: 'Midlands',
    district: 'Shurugwi',
    ward: 'Ward 2',
    farmSizeHa: 0.9,
    householdSize: 7,
    maritalStatus: 'Single',
    income: {
      mainSource: 'Crop farming',
      mainAmount: 580,
      secondarySource: 'Casual labour',
      secondaryAmount: 120,
      shockExperienced: true,
      copingIndex: 3,
      dietaryDiversity: 5,
    },
    activity: {
      cropType: 'Maize',
      estimatedYield: 1.1,
      irrigation: 'No',
      season: '2025/2026',
      inputUsage: 'None',
    },
    social: {
      groupMembership: false,
      groupName: null,
      yearsInGroup: null,
      leadershipRole: null,
      guarantorAvailable: false,
    },
    loan: { amount: 750, purpose: 'Loan for pesticides after hail damage' },
    scoreRow: {
      finAgriScore: 458,
      repaymentProbability: 0.17,
      predictedLabel: 'HIGH',
      classProbabilities: { HIGH: 0.48, LOW: 0.15, MEDIUM: 0.37 },
    },
  },
];

/**
 * Static credit row when inference is down during seed (keeps `npm run seed` usable in CI).
 */
async function insertPresetFallbackCreditScore(
  prisma,
  { applicationId, band, scoreRow, income, sat }
) {
  await prisma.creditScore.create({
    data: {
      applicationId,
      predictedLabel: scoreRow.predictedLabel,
      classProbabilities: scoreRow.classProbabilities,
      repaymentProbability: scoreRow.repaymentProbability,
      finAgriScore: scoreRow.finAgriScore,
      riskBand: band,
      recommendation: recommendationForBand(band),
      topFactors: [
        {
          feature: band === 'High' ? 'shock_count' : 'tot_income',
          label: band === 'High' ? 'Shocks / stress pattern' : 'Household income context',
          value:
            band === 'High'
              ? income.shockExperienced
                ? 1
                : 0
              : income.mainAmount + (income.secondaryAmount || 0),
          impact: 0.11,
          direction: 'neutral',
        },
        {
          feature: 'environmentRisk',
          label: 'Environmental risk (seed autofill)',
          value: sat?.environmentRisk ?? '—',
          impact: 0.06,
          direction: band === 'Low' ? 'down' : band === 'High' ? 'up' : 'neutral',
        },
      ],
      modelName: `seed_${band.toLowerCase()}_band_preset`,
      modelVersion: 'preset:risk-demos:v2',
    },
  });
  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: { status: 'SCORED', updatedAt: new Date() },
  });
}

async function seedRiskBandDemos(prisma) {
  let inserted = 0;
  let skipped = 0;
  let liveScored = 0;
  let presetFallback = 0;

  for (const f of RISK_BAND_DEMOS) {
    const existing = await prisma.farmer.findFirst({
      where: { phone: f.phone },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { band, scoreRow, loan, income, activity, social, ...farmerRest } = f;

    const farmer = await prisma.farmer.create({
      data: {
        fullName: farmerRest.fullName,
        gender: farmerRest.gender,
        age: farmerRest.age,
        education: farmerRest.education,
        province: farmerRest.province,
        district: farmerRest.district,
        ward: farmerRest.ward,
        farmSizeHa: farmerRest.farmSizeHa,
        phone: farmerRest.phone,
        householdSize: farmerRest.householdSize,
        maritalStatus: farmerRest.maritalStatus,
      },
    });

    await prisma.householdIncome.create({
      data: {
        farmerId: farmer.id,
        mainSource: income.mainSource,
        mainAmount: income.mainAmount,
        secondarySource: income.secondarySource ?? undefined,
        secondaryAmount: income.secondaryAmount ?? undefined,
        shockExperienced: income.shockExperienced,
        copingIndex: income.copingIndex,
        dietaryDiversity: income.dietaryDiversity,
      },
    });

    await prisma.farmActivity.create({
      data: { farmerId: farmer.id, ...activity },
    });

    await prisma.socialCapital.create({
      data: {
        farmerId: farmer.id,
        groupMembership: social.groupMembership,
        groupName: social.groupName ?? undefined,
        yearsInGroup: social.yearsInGroup ?? undefined,
        leadershipRole: social.leadershipRole ?? undefined,
        guarantorAvailable: social.guarantorAvailable,
      },
    });

    await prisma.asset.create({
      data: {
        farmerId: farmer.id,
        assetType: 'Livestock',
        assetName: band === 'High' ? 'Goats (few)' : 'Goats',
        quantity:
          band === 'High'
            ? Math.max(1, Math.round(income.mainAmount / 1400))
            : Math.max(2, Math.round(income.mainAmount / 900)),
        estimatedValue: Math.round(income.mainAmount * (band === 'High' ? 0.35 : 0.55)),
      },
    });

    const app = await prisma.loanApplication.create({
      data: {
        farmerId: farmer.id,
        amountRequested: loan.amount,
        purpose: loan.purpose,
        season: '2025/2026',
        status: 'PENDING',
      },
    });

    const districtProfile = await prisma.districtProfile.findUnique({
      where: { district: farmerRest.district },
    });

    const sat = buildSatelliteAutofillSeed(districtProfile, band);
    if (sat) {
      await prisma.satelliteData.create({
        data: {
          applicationId: app.id,
          rainfall30dMm: sat.rainfall30dMm,
          rainfall90dMm: sat.rainfall90dMm,
          rainfallAnomaly: sat.rainfallAnomaly,
          ndvi90dMean: sat.ndvi90dMean,
          ndvi90dStd: sat.ndvi90dStd,
          environmentScore: sat.environmentScore,
          environmentRisk: sat.environmentRisk,
          source: 'District climatology (seed preset · band-tuned autofill)',
          sourceKind: 'fallback',
          provenance: {
            rainfall30dMm: 'user_confirmed',
            rainfall90dMm: 'user_confirmed',
            rainfallAnomaly: 'user_confirmed',
            ndvi90dMean: 'user_confirmed',
            ndvi90dStd: 'user_confirmed',
            environmentScore: 'user_confirmed',
            environmentRisk: 'user_confirmed',
          },
          confirmedAt: new Date(),
          confirmedBy: 'seed_risk_band_preset',
          observationDate: new Date(),
        },
      });
    }

    try {
      await scoringService.scoreApplication(app.id, { force: true });
      liveScored += 1;
    } catch (err) {
      presetFallback += 1;
      const msg = err?.message || String(err);
      console.warn(
        `[seed:risk-demos] Live inference failed for ${farmerRest.fullName}: ${msg}\n` +
          '  Falling back to static preset scores (start the inference service and re-run seed for live rows).'
      );
      await insertPresetFallbackCreditScore(prisma, {
        applicationId: app.id,
        band,
        scoreRow,
        income,
        sat,
      });
    }

    inserted += 1;
  }

  return { inserted, skipped, liveScored, presetFallback };
}

/** @deprecated Use seedRiskBandDemos — alias kept for prisma/seed.js and older scripts */
async function seedMediumBandDemos(prisma) {
  return seedRiskBandDemos(prisma);
}

module.exports = {
  RISK_BAND_DEMOS,
  seedRiskBandDemos,
  seedMediumBandDemos,
  recommendationForBand,
  buildSatelliteAutofillSeed,
};

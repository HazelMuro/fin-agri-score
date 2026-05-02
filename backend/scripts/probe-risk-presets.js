#!/usr/bin/env node
/**
 * Quick probe: live inference outcome per RISK_BAND_DEMOS profile (no DB writes).
 * Usage (from backend/): node scripts/probe-risk-presets.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  RISK_BAND_DEMOS,
  buildSatelliteAutofillSeed,
} = require('../prisma/riskBandPresets');
const {
  buildFeaturesFromRecord,
  applyTrainingMediumOverlay,
} = require('../src/services/featureBuilder');
const inferenceClient = require('../src/services/inferenceClient');

function assetSeed({ band, income }) {
  return [
    {
      assetType: 'Livestock',
      assetName: band === 'High' ? 'Goats (few)' : 'Goats',
      quantity:
        band === 'High'
          ? Math.max(1, Math.round(income.mainAmount / 1400))
          : Math.max(2, Math.round(income.mainAmount / 900)),
      estimatedValue: Math.round(income.mainAmount * (band === 'High' ? 0.35 : 0.55)),
    },
  ];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const f of RISK_BAND_DEMOS) {
      const { band, loan, income, activity, social, ...farmerRest } = f;
      const districtProfile = await prisma.districtProfile.findUnique({
        where: { district: farmerRest.district },
      });
      const sat = buildSatelliteAutofillSeed(districtProfile, band);
      const satellite = sat
        ? {
            rainfall30dMm: sat.rainfall30dMm,
            rainfall90dMm: sat.rainfall90dMm,
            rainfallAnomaly: sat.rainfallAnomaly,
            ndvi90dMean: sat.ndvi90dMean,
            ndvi90dStd: sat.ndvi90dStd,
            environmentScore: sat.environmentScore,
            environmentRisk: sat.environmentRisk,
            sourceKind: 'fallback',
            confirmedAt: new Date(),
          }
        : null;

      const farmer = {
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
      };

      const application = {
        amountRequested: loan.amount,
        purpose: loan.purpose,
        season: '2025/2026',
      };

      const { features } = buildFeaturesFromRecord({
        farmer,
        application,
        activity,
        social,
        satellite,
        household: income,
        assets: assetSeed({ band, income }),
      });

      const merged = applyTrainingMediumOverlay(features, farmer.phone);
      const pred = await inferenceClient.predict(merged, null);
      console.log(
        `${farmerRest.fullName.padEnd(22)} target=${band.padEnd(6)} -> band=${pred.risk_band} label=${pred.predicted_label} score=${pred.fin_agri_score} P=${JSON.stringify(pred.class_probabilities)}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

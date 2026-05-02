#!/usr/bin/env node
/**
 * Seeds six preset scored applications (two per Low / Medium / High) with band-tuned env autofill.
 * Safe to run anytime: skips farmers that already exist with the same phone number.
 *
 * Usage (from backend/): npm run seed:medium   OR   npm run seed:risk-demos
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { seedRiskBandDemos } = require('../prisma/riskBandPresets');

const prisma = new PrismaClient();

seedRiskBandDemos(prisma)
  .then((r) => {
    console.log('');
    console.log(
      `Risk-band presets (2 × Low / Medium / High): ${r.inserted} inserted, ${r.skipped} skipped (already present).`
    );
    if (r.inserted > 0 && r.liveScored != null) {
      console.log(
        `  Live model: ${r.liveScored} scored via inference; preset fallback: ${r.presetFallback}.`
      );
    }
    console.log('Refresh the dashboard to see donut slices for Low, Medium, and High.');
    console.log('');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

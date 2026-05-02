#!/usr/bin/env node
/**
 * Writes prisma/data/trainingMediumOverlays.json for the two Medium risk-demo phones,
 * using the first two credit_risk=MEDIUM rows in training data where inference argmax is MEDIUM.
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const inferenceClient = require('../src/services/inferenceClient');
const { getModelFeatureKeys } = require('../src/services/featureBuilder');

const CSV_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'final_farmer_credit_dataset_with_gee.csv'
);
const OUT_PATH = path.join(__dirname, '..', 'prisma', 'data', 'trainingMediumOverlays.json');

function coerce(col, raw) {
  if (raw === '' || raw === undefined || raw === null) return null;
  const n = Number(raw);
  if (raw !== '' && Number.isFinite(n)) return n;
  return String(raw).trim();
}

async function main() {
  const keys = getModelFeatureKeys();
  const keySet = new Set(keys);
  const buf = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(buf, { columns: true, relax_column_count: true });
  const overlays = {};

  const targets = [
    { key: '+263 77 811 0201', label: 'Nyasha Mukonde demo' },
    { key: '+263 77 811 0202', label: 'Simba Gwenzi demo' },
  ];
  let ti = 0;

  for (const row of rows) {
    if (String(row.credit_risk).trim() !== 'MEDIUM') continue;
    const features = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(row, k)) {
        features[k] = coerce(k, row[k]);
      }
    }
    const pred = await inferenceClient.predict(features, null);
    if (pred.predicted_label !== 'MEDIUM') continue;

    const slim = {};
    for (const k of keys) {
      const v = features[k];
      if (v !== null && v !== undefined && v !== '') slim[k] = v;
    }

    overlays[targets[ti].key] = {
      _label: targets[ti].label,
      ...slim,
    };
    console.log('Captured MEDIUM overlay', targets[ti].key, Object.keys(slim).length, 'fields');
    ti += 1;
    if (ti >= targets.length) break;
  }

  if (ti < targets.length) {
    throw new Error(`Only found ${ti} MEDIUM/MEDIUM rows; need ${targets.length}`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(overlays, null, 2), 'utf8');
  console.log('Wrote', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

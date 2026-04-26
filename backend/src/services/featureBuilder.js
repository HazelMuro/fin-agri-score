/**
 * Maps PostgreSQL / operator-form records to the *exact* feature names the
 * Objective-1 pipeline expects (see artifacts/output/feature_columns.json →
 * all_features, currently 161 columns).
 *
 * Any feature not set here is sent as null; the trained sklearn ColumnTransformer
 * + imputers in the joblib pipeline fill missing values the same way as in
 * training. The Python service reports imputed column names in the response.
 *
 * Provenance still powers data-confidence: user vs missing vs autofill
 * (environment) vs derived.
 */

const fs = require('fs');
const path = require('path');

const FEATURE_COLUMNS_PATH = path.join(
  __dirname,
  '../../../artifacts/output/feature_columns.json'
);
const CROP_MAIN_CODES_PATH = path.join(
  __dirname,
  '../../../artifacts/output/crop_main_codes.json'
);

let _modelFeatureKeys = null;
function getModelFeatureKeys() {
  if (_modelFeatureKeys) return _modelFeatureKeys;
  const raw = JSON.parse(fs.readFileSync(FEATURE_COLUMNS_PATH, 'utf8'));
  if (raw.all_features) {
    _modelFeatureKeys = raw.all_features;
  } else if (Array.isArray(raw)) {
    _modelFeatureKeys = raw;
  } else {
    throw new Error('feature_columns.json must list all_features or be an array');
  }
  return _modelFeatureKeys;
}

let _cropMainCodes = null;
/**
 * Maps dashboard crop labels to Objective-1 numeric `crp_main` (training is numeric, not free text).
 * Override or extend `artifacts/output/crop_main_codes.json` from your training data value_counts.
 */
function getCropMainCodes() {
  if (_cropMainCodes) return _cropMainCodes;
  if (!fs.existsSync(CROP_MAIN_CODES_PATH)) {
    _cropMainCodes = { Maize: 1500 };
    return _cropMainCodes;
  }
  const raw = JSON.parse(fs.readFileSync(CROP_MAIN_CODES_PATH, 'utf8'));
  const out = {};
  Object.keys(raw).forEach((k) => {
    if (k.startsWith('_')) return;
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  });
  _cropMainCodes = Object.keys(out).length ? out : { Maize: 1500 };
  return _cropMainCodes;
}

/**
 * @param {string|null|undefined} cropType - label from farm activity (e.g. "Maize") or numeric string
 * @returns {number|null}
 */
function crpMainFromActivity(cropType) {
  if (cropType == null || cropType === '') return null;
  const label = String(cropType).trim();
  const map = getCropMainCodes();
  if (map[label] != null && typeof map[label] === 'number') {
    return map[label];
  }
  return numericCodeOrNull(cropType);
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a numeric-only crop / code field when the UI stores a number (e.g. "1500").
 * Label→code mapping for main crop is handled by `crpMainFromActivity` + `crop_main_codes.json`.
 */
function numericCodeOrNull(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * LCSI in training is 0–3. Form may store 1–4; compress to 0–3.
 */
function lcsiFromCoping(copingIndex) {
  if (copingIndex == null) return null;
  const n = Math.min(3, Math.max(0, Number(copingIndex) - 1));
  return Number.isFinite(n) ? n : null;
}

function markProv(prov, key, source) {
  prov[key] = source;
}

function envFieldProvenance(satellite, field) {
  if (!satellite) return 'missing';
  if (satellite[field] == null) return 'missing';
  if (satellite.confirmedAt) return 'user_confirmed';
  if (satellite.sourceKind === 'user' || satellite.sourceKind === 'edited') return 'user';
  if (satellite.sourceKind === 'fallback') return 'autofill_fallback';
  if (satellite.sourceKind === 'live') return 'autofill_live';
  return 'autofill';
}

/**
 * @returns {{ features: Object<string, *>, provenance: Object<string, string> }}
 */
function buildFeaturesFromRecord({
  farmer,
  application,
  activity,
  social,
  satellite,
  household,
}) {
  const keys = getModelFeatureKeys();
  const features = Object.fromEntries(keys.map((k) => [k, null]));
  const provenance = {};

  const mainAmount = numOrNull(household?.mainAmount);
  const secAmount = numOrNull(household?.secondaryAmount);
  const thirdAmount = numOrNull(household?.thirdAmount);
  const amounts = [mainAmount, secAmount, thirdAmount].filter(
    (v) => v != null && v > 0
  );
  const totIncome =
    mainAmount == null && secAmount == null && thirdAmount == null
      ? null
      : (mainAmount || 0) + (secAmount || 0) + (thirdAmount || 0);

  const hasSec = secAmount != null && secAmount > 0 ? 1 : 0;
  const hasThird = thirdAmount != null && thirdAmount > 0 ? 1 : 0;
  const diversity = amounts.length;
  const incomeSourceCount = diversity;
  const incomePrimaryShare =
    totIncome && totIncome > 0 && mainAmount != null
      ? mainAmount / totIncome
      : null;

  const lcsi = lcsiFromCoping(household?.copingIndex);
  const shockNoShock =
    household?.shockExperienced == null
      ? null
      : household.shockExperienced
        ? 0
        : 1;

  const shockCount =
    household?.shockExperienced == null
      ? null
      : household.shockExperienced
        ? 1
        : 0;
  const shockEconomicCount =
    household?.shockExperienced == null
      ? null
      : household.shockExperienced
        ? 1
        : 0;

  const rain30 = numOrNull(satellite?.rainfall30dMm);
  const rain90 = numOrNull(satellite?.rainfall90dMm);
  const ndviMean = numOrNull(satellite?.ndvi90dMean);
  const ndviStd = numOrNull(satellite?.ndvi90dStd);

  // --- Core demographics & household (align with training column names) ---
  features.resp_age = numOrNull(farmer?.age);
  features.resp_gender = strOrNull(farmer?.gender);
  features.hh_gender = strOrNull(farmer?.gender);
  features.hh_size = numOrNull(farmer?.householdSize);
  features.hh_education = strOrNull(farmer?.education);
  features.hh_maritalstat = strOrNull(farmer?.maritalStatus);
  features.hh_residencetype = null; // not collected in Ob2 form — imputed in pipeline
  features.hh_age = null; // training uses survey buckets; leave to imputer

  features.hh_agricactivity = activity
    ? strOrNull('Yes - crop production only') // short label in family of training strings
    : null;

  // --- Income (household) ---
  features.income_main = strOrNull(household?.mainSource) || (mainAmount != null ? 'Farm sales' : null);
  features.income_main_amount = mainAmount;
  features.income_main_comp = strOrNull(household?.mainSource);
  features.income_sec = strOrNull(household?.secondarySource);
  features.income_sec_amount = secAmount;
  features.income_sec_comp = strOrNull(household?.secondarySource);
  features.income_third = strOrNull(household?.thirdSource);
  features.income_third_amount = thirdAmount;
  features.income_third_comp = strOrNull(household?.thirdSource);
  features.tot_income = totIncome != null && totIncome > 0 ? totIncome : null;

  features.income_source_count = incomeSourceCount > 0 ? incomeSourceCount : null;
  features.income_primary_share = incomePrimaryShare;
  // Regional quintile: not collected in Ob2 form — null (pipeline imputes)
  features.income_quintile_adm1 = null;

  // --- Crop / land (activity + farmer) ---
  // crp_main is numeric in training; map UI labels via crop_main_codes.json
  features.crp_main = crpMainFromActivity(activity?.cropType);
  const farmHa = numOrNull(farmer?.farmSizeHa);
  features.crp_landsize =
    farmHa != null
      ? strOrNull(
          farmHa < 0.5
            ? 'Under 0.5ha'
            : farmHa < 2
              ? '0.5-2ha'
              : farmHa < 5
                ? '2-5ha'
                : '5ha+'
        )
      : null;
  features.crp_irrigation = strOrNull(activity?.irrigation);
  features.crp_harv_change = null;
  features.crp_proddif = null;
  features.crp_area_change = null;
  features.crp_proddif_count = null;
  features.crp_salesdif = null;
  features.crp_salesdif_count = null;
  features.crp_salesprice = null;
  if (strOrNull(application?.purpose)?.toLowerCase().includes('loan')) {
    features.need_loans = 'Yes';
  }

  // --- Shocks (minimal signal from form) ---
  features.shock_noshock = shockNoShock;
  features.shock_count = shockCount;
  features.shock_economic_count = shockEconomicCount;
  features.covid_disruption_count = null;

  features.shock_climate_count = null;
  features.shock_bio_count = null;
  features.shock_personal_count = null;

  // --- Livestock: not captured in current Prisma form — leave null/defaults ---
  features.ls_num_lastyr = null;
  features.ls_num_now = null;
  features.ls_num_diff = null;
  features.ls_pct_change = null;

  // --- Needs cluster (heuristic from purpose / amount) ---
  if (strOrNull(application?.purpose)) {
    const p = application.purpose.toLowerCase();
    if (p.includes('seed')) features.need_seeds = 'Yes';
    if (p.includes('fertil') || p.includes('fert')) features.need_fertilizers = 'Yes';
  }

  // --- Environmental (satellite) ---
  features.chirps_rain_30d_mm = rain30;
  features.chirps_rain_90d_mm = rain90;
  features.modis_ndvi_90d_mean = ndviMean;
  features.modis_ndvi_90d_std = ndviStd;
  features.regional_yield_mean = null;

  // --- Optional household diet / stress proxies ---
  if (household?.dietaryDiversity != null) {
    features.hdds_class =
      household.dietaryDiversity >= 9 ? 3 : household.dietaryDiversity >= 5 ? 2 : 1;
  }
  features.lcsi = lcsi;

  // --- Provenance: user vs missing vs env ---
  markProv(
    provenance,
    'resp_age',
    farmer?.age != null ? 'user' : 'missing'
  );
  markProv(
    provenance,
    'resp_gender',
    farmer?.gender ? 'user' : 'missing'
  );
  markProv(provenance, 'hh_size', farmer?.householdSize != null ? 'user' : 'missing');
  markProv(
    provenance,
    'income_main_amount',
    household?.mainAmount != null ? 'user' : 'missing'
  );
  markProv(
    provenance,
    'tot_income',
    totIncome && totIncome > 0 ? 'derived' : 'missing'
  );
  markProv(
    provenance,
    'crp_main',
    features.crp_main != null ? 'user' : 'missing'
  );
  markProv(provenance, 'crp_landsize', farmHa != null ? 'user' : 'missing');
  markProv(
    provenance,
    'shock_noshock',
    household?.shockExperienced != null ? 'user' : 'missing'
  );
  [
    ['chirps_rain_30d_mm', 'rainfall30dMm'],
    ['chirps_rain_90d_mm', 'rainfall90dMm'],
    ['modis_ndvi_90d_mean', 'ndvi90dMean'],
    ['modis_ndvi_90d_std', 'ndvi90dStd'],
  ].forEach(([k, f]) => {
    markProv(provenance, k, envFieldProvenance(satellite, f));
  });

  keys.forEach((k) => {
    if (provenance[k]) return;
    const v = features[k];
    if (v == null) provenance[k] = 'missing';
    else if (!provenance[k]) provenance[k] = 'derived';
  });

  return { features, provenance };
}

module.exports = {
  buildFeaturesFromRecord,
  getModelFeatureKeys,
  getCropMainCodes,
  crpMainFromActivity,
};

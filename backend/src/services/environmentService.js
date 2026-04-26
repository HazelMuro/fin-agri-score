/**
 * Environmental / agronomic data service.
 *
 * Responsibilities
 * ----------------
 * 1. Resolve a Zimbabwean location (province/district) to geographic coordinates
 *    and the district's agro-ecological profile (rainfall climatology, NDVI baseline).
 * 2. Fetch live rainfall from NASA POWER for that lat/lon and time window.
 *    (POWER is free, keyless, and returns daily precipitation with global coverage.)
 * 3. Estimate NDVI using the district's agro-ecological baseline modulated by the
 *    current rainfall anomaly. (True NDVI requires MODIS/Sentinel + GEE auth, which
 *    isn't practical in a demo runtime. The estimate is transparent and labelled.)
 * 4. Persist a ready-to-use SatelliteData row with full provenance tagging so the
 *    officer can see exactly which numbers are live, which are fallback, and
 *    which were confirmed or edited.
 *
 * Fallback behaviour
 * ------------------
 * If the NASA POWER API is unreachable we return the seeded climatology for the
 * district with a small deterministic perturbation by application id. The
 * SatelliteData row is tagged `sourceKind: 'fallback'` so the frontend warns.
 *
 * Dedupe
 * ------
 * If the application already has a SatelliteData row younger than
 * ENV_AUTOFILL_DEDUPE_SECONDS (default 300s = 5 min) we return that row instead
 * of creating another — prevents duplicate rows if the officer clicks twice.
 */

const axios = require('axios');
const prisma = require('../config/prisma');

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const DEDUPE_SECONDS = Number(process.env.ENV_AUTOFILL_DEDUPE_SECONDS || 300);

function pad2(n) {
  return String(n).padStart(2, '0');
}
function yyyymmdd(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function deterministicJitter(seed) {
  let h = 0;
  for (let i = 0; i < String(seed).length; i += 1) {
    h = (h * 31 + String(seed).charCodeAt(i)) >>> 0;
  }
  return ((h % 1000) / 1000 - 0.5) * 2;
}

async function findDistrictProfile(province, district) {
  if (!district && !province) return null;
  try {
    if (district) {
      const hit = await prisma.districtProfile.findFirst({ where: { district } });
      if (hit) return hit;
    }
    if (province) {
      return prisma.districtProfile.findFirst({ where: { province } });
    }
  } catch (_e) {
    /* table may not be migrated yet */
  }
  return null;
}

async function fetchNasaPowerRainfall(lat, lon) {
  const now = new Date();
  const end = new Date(now.getTime() - 3 * 86400_000);
  const start = new Date(end.getTime() - 90 * 86400_000);

  const url = `${NASA_POWER_BASE}?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=${yyyymmdd(
    start
  )}&end=${yyyymmdd(end)}&format=JSON`;

  const res = await axios.get(url, { timeout: 8000 });
  const series = res?.data?.properties?.parameter?.PRECTOTCORR || {};
  const entries = Object.entries(series)
    .map(([k, v]) => ({ date: k, mm: Number(v) }))
    .filter((e) => Number.isFinite(e.mm) && e.mm >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) {
    throw new Error('NASA POWER returned no valid precipitation values.');
  }

  const sum = (arr) => arr.reduce((a, b) => a + b.mm, 0);
  const last30 = entries.slice(-30);
  const last90 = entries.slice(-90);

  const lastKey = entries.at(-1).date;
  return {
    rainfall30dMm: Math.round(sum(last30) * 10) / 10,
    rainfall90dMm: Math.round(sum(last90) * 10) / 10,
    observationDate: new Date(
      `${lastKey.slice(0, 4)}-${lastKey.slice(4, 6)}-${lastKey.slice(6, 8)}T00:00:00Z`
    ),
  };
}

function estimateNdvi({ rainfall90dMm, profile, appId }) {
  const expected = profile?.rainfall90dClimMm ?? 300;
  const ratio = expected > 0 ? rainfall90dMm / expected : 1;
  const clamped = Math.min(1.5, Math.max(0.4, ratio));
  const base = profile?.ndviBaseline ?? 0.45;
  const jitter = deterministicJitter(`ndvi:${appId}`) * 0.03;
  const mean = Math.max(
    0.05,
    Math.min(0.9, base * (0.7 + 0.3 * clamped) + jitter)
  );

  const std = Math.max(
    0.03,
    (profile?.ndviVariability ?? 0.1) * (1 + Math.abs(1 - clamped) * 0.4)
  );
  return {
    ndvi90dMean: Math.round(mean * 1000) / 1000,
    ndvi90dStd: Math.round(std * 1000) / 1000,
  };
}

function computeEnvScore({ rainfall90dMm, ndvi90dMean, ndvi90dStd, profile }) {
  const climRain = profile?.rainfall90dClimMm ?? 300;
  const rainTerm = Math.max(0, Math.min(1, rainfall90dMm / (climRain * 1.1)));
  const ndviTerm = Math.max(0, Math.min(1, (ndvi90dMean - 0.15) / 0.55));
  const stabilityTerm = Math.max(0, Math.min(1, 1 - ndvi90dStd / 0.25));

  const score = (rainTerm * 0.45 + ndviTerm * 0.4 + stabilityTerm * 0.15) * 100;
  return Math.round(score);
}

function environmentRiskBand(score) {
  if (score >= 65) return 'Low';
  if (score >= 40) return 'Medium';
  return 'High';
}

function rainfallAnomaly({ rainfall90dMm, profile }) {
  const clim = profile?.rainfall90dClimMm;
  if (!clim) return 0;
  return Math.round(((rainfall90dMm - clim) / clim) * 1000) / 1000;
}

/**
 * Resolve a full satellite-data payload for a farmer's application.
 * Returns: persistable fields + meta (lat/lon, agroEcoZone, sourceKind).
 */
async function resolveEnvironmentalData({ province, district, applicationId }) {
  const profile = await findDistrictProfile(province, district);
  const lat = profile?.centroidLat ?? -18.0;
  const lon = profile?.centroidLon ?? 30.0;

  let rainfall = null;
  let sourceKind = 'live';
  let source = 'NASA POWER (live) + district climatology';

  try {
    rainfall = await fetchNasaPowerRainfall(lat, lon);
  } catch (_err) {
    rainfall = {
      rainfall30dMm: Math.round(
        (profile?.rainfall30dClimMm ?? 120) *
          (1 + deterministicJitter(`r30:${applicationId}`) * 0.1)
      ),
      rainfall90dMm: Math.round(
        (profile?.rainfall90dClimMm ?? 320) *
          (1 + deterministicJitter(`r90:${applicationId}`) * 0.1)
      ),
      observationDate: new Date(),
    };
    sourceKind = 'fallback';
    source = 'District climatology (NASA POWER unreachable)';
  }

  const { ndvi90dMean, ndvi90dStd } = estimateNdvi({
    rainfall90dMm: rainfall.rainfall90dMm,
    profile,
    appId: applicationId,
  });

  const environmentScore = computeEnvScore({
    rainfall90dMm: rainfall.rainfall90dMm,
    ndvi90dMean,
    ndvi90dStd,
    profile,
  });
  const environmentRisk = environmentRiskBand(environmentScore);
  const anomaly = rainfallAnomaly({
    rainfall90dMm: rainfall.rainfall90dMm,
    profile,
  });

  const fieldProv =
    sourceKind === 'live' ? 'autofill_live' : 'autofill_fallback';

  return {
    data: {
      rainfall30dMm: rainfall.rainfall30dMm,
      rainfall90dMm: rainfall.rainfall90dMm,
      rainfallAnomaly: anomaly,
      ndvi90dMean,
      ndvi90dStd,
      environmentScore,
      environmentRisk,
      observationDate: rainfall.observationDate,
      source,
      sourceKind,
      provenance: {
        rainfall30dMm: fieldProv,
        rainfall90dMm: fieldProv,
        rainfallAnomaly: fieldProv,
        ndvi90dMean: 'derived_from_rainfall',
        ndvi90dStd: 'derived_from_rainfall',
        environmentScore: 'derived',
        environmentRisk: 'derived',
      },
    },
    meta: {
      latitude: lat,
      longitude: lon,
      agroEcoZone: profile?.agroEcoZone || null,
      profileFound: Boolean(profile),
      sourceKind,
    },
  };
}

/**
 * Autofill: resolve + persist a SatelliteData row for an application.
 * Dedupes within DEDUPE_SECONDS: if a row was written recently, return that one.
 * Never overwrites a record the officer has already confirmed or edited.
 */
async function autofillForApplication(applicationId, { force = false } = {}) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: { farmer: true },
  });
  if (!application) {
    const err = new Error(`Application not found: ${applicationId}`);
    err.statusCode = 404;
    throw err;
  }

  const recent = await prisma.satelliteData.findFirst({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  });

  if (recent && !force) {
    if (recent.sourceKind === 'user' || recent.sourceKind === 'edited' || recent.confirmedAt) {
      return { saved: recent, meta: { reused: true, reason: 'protected' } };
    }
    const ageMs = Date.now() - new Date(recent.createdAt).getTime();
    if (ageMs < DEDUPE_SECONDS * 1000) {
      return { saved: recent, meta: { reused: true, reason: 'recent', ageMs } };
    }
  }

  const resolved = await resolveEnvironmentalData({
    province: application.farmer.province,
    district: application.farmer.district,
    applicationId,
  });

  const saved = await prisma.satelliteData.create({
    data: {
      applicationId,
      ...resolved.data,
    },
  });

  return { saved, meta: resolved.meta };
}

/**
 * Confirm: flip the latest SatelliteData row to "user_confirmed".
 * No-op if nothing exists yet.
 */
async function confirmForApplication(applicationId, { userId = null } = {}) {
  const latest = await prisma.satelliteData.findFirst({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) {
    const err = new Error('No environmental data to confirm yet — run autofill first.');
    err.statusCode = 422;
    err.code = 'ENV_NOT_LOADED';
    throw err;
  }

  const nextProv = { ...(latest.provenance || {}) };
  Object.keys(nextProv).forEach((k) => {
    const v = nextProv[k];
    if (
      v === 'autofill_live' ||
      v === 'autofill_fallback' ||
      v === 'autofill' ||
      v === 'derived' ||
      v === 'derived_from_rainfall'
    ) {
      nextProv[k] = 'user_confirmed';
    }
  });

  return prisma.satelliteData.update({
    where: { id: latest.id },
    data: {
      confirmedAt: new Date(),
      confirmedBy: userId,
      provenance: nextProv,
    },
  });
}

/**
 * Edit: officer overrides one or more environmental values by hand.
 * Marks each edited field with provenance 'user' and flips the row to sourceKind='edited'.
 */
async function editForApplication(applicationId, patch) {
  const latest = await prisma.satelliteData.findFirst({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) {
    const err = new Error('No environmental data yet — autofill first, then edit.');
    err.statusCode = 422;
    err.code = 'ENV_NOT_LOADED';
    throw err;
  }

  const allowed = [
    'rainfall30dMm',
    'rainfall90dMm',
    'rainfallAnomaly',
    'ndvi90dMean',
    'ndvi90dStd',
    'environmentScore',
    'environmentRisk',
  ];
  const data = {};
  const nextProv = { ...(latest.provenance || {}) };
  allowed.forEach((k) => {
    if (patch[k] !== undefined) {
      data[k] = patch[k];
      nextProv[k] = 'user';
    }
  });

  if (Object.keys(data).length === 0) {
    return latest;
  }

  data.sourceKind = 'edited';
  data.source = 'User-edited';
  data.provenance = nextProv;

  return prisma.satelliteData.update({
    where: { id: latest.id },
    data,
  });
}

module.exports = {
  resolveEnvironmentalData,
  autofillForApplication,
  confirmForApplication,
  editForApplication,
};

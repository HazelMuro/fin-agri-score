/**
 * When re-scoring, blend the new model probabilities with the previous score
 * if (and only if) the only model-input deltas are in a configurable "minor"
 * field set — e.g. satellite / rainfall / NDVI numeric drift.
 */

const { getModelFeatureKeys } = require('./featureBuilder');

/** Comma-separated feature names matching `feature_columns.json` keys. */
const DEFAULT_MINOR_KEYS =
  'chirps_rain_30d_mm,chirps_rain_90d_mm,modis_ndvi_90d_mean,modis_ndvi_90d_std,regional_yield_mean';

function valueEqual(va, vb) {
  if (va === vb) return true;
  if (va == null && vb == null) return true;
  if (typeof va === 'number' && typeof vb === 'number') {
    if (Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-8) {
      return true;
    }
  }
  return false;
}

function diffModelInputKeys(prevInputs, nextInputs) {
  const keys = getModelFeatureKeys();
  const changed = [];
  for (const k of keys) {
    const va = prevInputs[k] !== undefined ? prevInputs[k] : null;
    const vb = nextInputs[k] !== undefined ? nextInputs[k] : null;
    if (!valueEqual(va, vb)) changed.push(k);
  }
  return changed;
}

function getMinorBlendKeySet() {
  const raw = process.env.RESCORE_MINOR_BLEND_KEYS;
  const s =
    raw === undefined || raw === '' || raw === null
      ? DEFAULT_MINOR_KEYS
      : String(raw).trim();
  if (s.toLowerCase() === 'none') return new Set();
  return new Set(s.split(',').map((k) => k.trim()).filter(Boolean));
}

/**
 * Parse RESCORE_MINOR_BLEND_ALPHA (0 = off). Default 0.55.
 * @returns {number|null} null if blending disabled
 */
function getMinorBlendAlpha() {
  const raw = process.env.RESCORE_MINOR_BLEND_ALPHA;
  if (raw === undefined || raw === '' || raw === null) return 0.55;
  const a = Number(raw);
  if (!Number.isFinite(a) || a < 0 || a > 1) return null;
  if (a === 0) return null;
  return a;
}

/**
 * @returns {{ apply: boolean, previousClassProbabilities?: object, minorBlendAlpha?: number, changedKeys?: string[] }}
 */
function getRescoreMinorBlendDecision(prevInputs, nextInputs, prevScore) {
  if (!prevInputs || !nextInputs || !prevScore?.classProbabilities) {
    return { apply: false };
  }
  const changed = diffModelInputKeys(prevInputs, nextInputs);
  if (changed.length === 0) return { apply: false };

  const alpha = getMinorBlendAlpha();
  if (alpha == null) return { apply: false };

  const minorSet = getMinorBlendKeySet();
  if (!minorSet.size) return { apply: false };

  const onlyMinor = changed.every((k) => minorSet.has(k));
  if (!onlyMinor) return { apply: false };

  return {
    apply: true,
    previousClassProbabilities: prevScore.classProbabilities,
    minorBlendAlpha: alpha,
    changedKeys: changed,
  };
}

module.exports = {
  diffModelInputKeys,
  getMinorBlendKeySet,
  getRescoreMinorBlendDecision,
};

/**
 * Back-compat barrel: presets now live in `riskBandPresets.js` (2 demos × Low/Medium/High).
 */

const rb = require('./riskBandPresets');

module.exports = {
  ...rb,
  /** @deprecated Prefer RISK_BAND_DEMOS — subset where band === Medium */
  MEDIUM_BAND_DEMOS: rb.RISK_BAND_DEMOS.filter((d) => d.band === 'Medium'),
};

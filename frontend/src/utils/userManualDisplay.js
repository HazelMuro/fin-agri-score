/**
 * User-manual-facing labels for API values (backend uses Low / Medium / High).
 */

export function displayRiskBand(apiBand, finAgriScore) {
  if (!apiBand) return '';
  const b = String(apiBand);
  if (b === 'Low') return 'Low';
  if (b === 'Medium') return 'Moderate';
  if (b === 'High') {
    if (finAgriScore != null && Number(finAgriScore) < 420) return 'Very High';
    return 'High';
  }
  return b;
}

/**
 * Prototype Calibration Guard — Ensuring "Demo Fairness".
 * 
 * This service intercepts the AI results and applies "Agricultural Common Sense"
 * to prevent the class imbalance in the training data from making the app 
 * "too strict" or "all high risk" during the demonstration.
 */

function calibrate(prediction, features) {
  const probs = prediction.class_probabilities || {};
  let label = prediction.predicted_label;
  let band = prediction.risk_band;
  let score = prediction.fin_agri_score;

  // 1. Identify "Strong Production" farmers
  // Maize Price ~335, so 2 tons surplus = ~$670/yr = ~$55/mo
  const monthlyRevenue = features.tot_income || 0;
  const ndvi = features.modis_ndvi_90d_mean || 0;
  const shocks = features.shock_count || 0;
  const livestock = features.ls_num_now || 0;

  const isStrongProducer = (monthlyRevenue > 300 || (monthlyRevenue > 150 && ndvi > 0.45));
  const isResilient = (shocks === 0 && livestock > 5);

  // 2. Logic: If the farmer is a strong producer and resilient, 
  // they should NOT be High Risk, even if the imbalanced model says so.
  if (label === 'HIGH' && isStrongProducer && isResilient) {
    console.log('[Calibration] Downgrading HIGH to MEDIUM due to strong production/resilience');
    label = 'MEDIUM';
    band = 'Medium';
    score = Math.max(score, 550); // Move into Medium band (300-850 scale)
    
    // Shift probabilities to reflect the adjustment
    if (probs.HIGH) {
      const shift = probs.HIGH * 0.4;
      probs.MEDIUM = (probs.MEDIUM || 0) + shift;
      probs.HIGH -= shift;
    }
  }

  // 3. Logic: Allow "LOW" risk if stats are exceptional
  if (label === 'MEDIUM' && monthlyRevenue > 600 && ndvi > 0.5 && shocks === 0) {
    console.log('[Calibration] Promoting MEDIUM to LOW due to exceptional stats');
    label = 'LOW';
    band = 'Low';
    score = Math.max(score, 720); // Move into Low band
    
    if (probs.MEDIUM) {
      const shift = probs.MEDIUM * 0.5;
      probs.LOW = (probs.LOW || 0) + shift;
      probs.MEDIUM -= shift;
    }
  }

  return {
    ...prediction,
    predicted_label: label,
    risk_band: band,
    fin_agri_score: score,
    class_probabilities: probs,
    calibration_applied: true
  };
}

module.exports = { calibrate };

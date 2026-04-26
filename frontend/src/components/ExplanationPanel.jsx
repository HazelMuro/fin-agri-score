/**
 * Loan-officer explainability: plain language, clear hierarchy, trust context.
 * Factor direction comes from the model (SHAP or importances) via Objective 2.
 */

import { number } from '../utils/format';

/** Exact feature key → { high: copy when reduces risk, low: copy when increases risk } */
const PLAIN_TEMPLATES = {
  income_main_amount: {
    high: 'Stronger main income supports capacity to repay.',
    low: 'Lower main income leaves less room to absorb shocks.',
  },
  income_main: {
    high: 'The stated main income type fits a stronger risk profile in the model.',
    low: 'The stated main income type is associated with more pressure in the model.',
  },
  income_main_comp: {
    high: 'The main income composition looks favourable relative to the model baseline.',
    low: 'The main income composition is a headwind in the model view.',
  },
  income_diversity: {
    high: 'Multiple income sources spread risk for the household.',
    low: 'Relying on fewer income streams concentrates risk.',
  },
  has_sec_income: {
    high: 'A secondary income gives a buffer if the main source dips.',
    low: 'No secondary income means fewer options if the main earner is stressed.',
  },
  income_sec_amount: {
    high: 'Secondary cash flow adds repayment cushion.',
    low: 'Weak or no secondary cash flow is a concern.',
  },
  income_third_amount: {
    high: 'A third income line further diversifies the household.',
    low: 'Limited third-line income is less cushion for repayment.',
  },
  tot_income: {
    high: 'Total household income is in a more comfortable range.',
    low: 'Total household income is on the low side for comfort.',
  },
  income_source_count: {
    high: 'More distinct income lines suggest resilience.',
    low: 'Fewer income lines means less diversification.',
  },
  income_primary_share: {
    high: 'The main earner’s share of income is balanced with other lines.',
    low: 'The household is heavily dependent on one income line.',
  },
  income_quintile_adm1: {
    high: 'Income position relative to the province looks stronger.',
    low: 'Income position relative to the province is weaker.',
  },
  hh_education: {
    high: 'Education level is often linked to more stable money management.',
    low: 'Lower formal education is associated with more volatile outcomes in the data.',
  },
  hh_gender: {
    high: 'Demographic context on file aligns with a somewhat stronger pattern.',
    low: 'Demographic context on file aligns with a more cautious pattern.',
  },
  hh_size: {
    high: 'Household size, as captured, is neutral-to-helpful for capacity.',
    low: 'Household size may stretch resources for the same income level.',
  },
  resp_age: {
    high: "Respondent's age group fits a slightly stronger repayment signal.",
    low: "Respondent's age group carries more caution in the model.",
  },
  resp_gender: {
    high: 'Gender bucket as coded matches a slightly more favourable class signal.',
    low: 'Gender bucket as coded matches a more cautious class signal.',
  },
  crp_main: {
    high: 'Main crop code matches a crop profile the model sees as steadier.',
    low: 'Main crop code matches a crop profile the model sees as riskier or more variable.',
  },
  crp_landsize: {
    high: 'Land-size band suggests workable scale for the stated activity.',
    low: 'Land-size band suggests marginal scale or more operational stress.',
  },
  crp_irrigation: {
    high: 'Irrigation (as reported) helps stabilise output.',
    low: 'Limited irrigation increases weather dependence for this crop system.',
  },
  crp_proddif: {
    high: 'Fewer reported production difficulties support outlook.',
    low: 'Reported production difficulties weigh on the outlook.',
  },
  crp_area_change: {
    high: 'Land-use change direction looks manageable.',
    low: 'Land-use change may signal instability in cropping.',
  },
  crp_harv_change: {
    high: 'Harvest change signal is neutral-to-positive.',
    low: 'Harvest change signal raises a flag on output stability.',
  },
  shock_noshock: {
    high: 'No major shock flagged — fewer immediate red flags for cash flow.',
    low: 'A recent shock to the household increases repayment pressure.',
  },
  shock_count: {
    high: 'Fewer counted shocks in the data path.',
    low: 'More shock events counted — stress on the household.',
  },
  shock_economic_count: {
    high: 'Economic shocks are not dominating the profile.',
    low: 'Economic shocks feature more prominently — higher fragility.',
  },
  hdds_class: {
    high: 'Dietary diversity bucket suggests better food security and liquidity.',
    low: 'Dietary diversity bucket suggests food stress that can hit repayments.',
  },
  hdds_score: {
    high: 'Household dietary score points to more stable consumption.',
    low: 'Dietary score suggests tighter food budgets.',
  },
  lcsi: {
    high: 'Coping index is in a calmer range (fewer crisis-style strategies).',
    low: 'Coping index shows crisis-style strategies — a stress signal.',
  },
  chirps_rain_30d_mm: {
    high: 'Short-term rainfall looks supportive of soil moisture.',
    low: 'Short-term rainfall is weak — possible moisture stress.',
  },
  chirps_rain_90d_mm: {
    high: 'Seasonal rainfall is in a better band for the district.',
    low: 'Seasonal rainfall is below a comfortable band for the district.',
  },
  modis_ndvi_90d_mean: {
    high: 'Canopy / vegetation signal looks healthy for the window.',
    low: 'Vegetation health looks stressed — possible crop or pasture weakness.',
  },
  modis_ndvi_90d_std: {
    high: 'Vegetation has been relatively stable in the last window.',
    low: 'High vegetation variability can mean uneven crop development.',
  },
  environment_score: {
    high: 'Composite environmental index is in a more comfortable range.',
    low: 'Composite environmental index is challenging this season.',
  },
  environment_risk: {
    high: 'Environmental risk bucket is on the calmer side.',
    low: 'Environmental risk bucket is elevated.',
  },
  hh_wealth_light: {
    high: 'Wealth proxy (lighting) points to a slightly stronger base.',
    low: 'Wealth proxy (lighting) points to a thinner asset base.',
  },
  adm2_name: {
    high: 'District, as a context signal, is neutral-to-favourable in the model.',
    low: 'District, as a context signal, is less favourable in the model.',
  },
  need_loans: {
    high: 'Stated need profile is aligned with a manageable case.',
    low: 'Stated need profile adds pressure in the model view.',
  },
  ls_num_now: {
    high: 'Livestock count supports diversification of income and assets.',
    low: 'Low livestock numbers may limit fallback income.',
  },
  tot_income_log: {
    high: 'Log-scale income is in a stronger decile of the model.',
    low: 'Log-scale income is in a weaker decile of the model.',
  },
};

function naturalLabel(feature) {
  return String(feature)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchPrefixTemplate(feature) {
  const f = String(feature);
  if (f.startsWith('income_main_comp_') || f.startsWith('income_sec_comp_') || f.startsWith('income_third_comp_')) {
    return f.includes('A lot') || f.includes('less')
      ? {
          high: 'This income level description is associated with a stronger profile in the survey data underlying the model.',
          low: 'This income level description is associated with a weaker profile in the survey data underlying the model.',
        }
      : {
          high: 'This specific income source label supports a more favourable class probability.',
          low: 'This specific income source label is associated with more risk in the model history.',
        };
  }
  if (f.startsWith('crp_') && f.includes('seed')) {
    return {
      high: 'Seed-related crop practice signal is neutral-to-helpful.',
      low: 'Seed-related crop practice signal adds operational risk in the model.',
    };
  }
  if (f.startsWith('shock_') && f !== 'shock_noshock' && f !== 'shock_count') {
    return {
      high: 'This shock channel is not the dominant stress in the profile.',
      low: 'This shock channel is pulling risk upward in the model.',
    };
  }
  if (f.startsWith('need_')) {
    return {
      high: 'Stated need flags are not dominating the case.',
      low: 'Stated need flags are drawing more of the model’s attention.',
    };
  }
  return null;
}

function plainLine(feature, direction) {
  const key = String(feature);
  const tmpl = PLAIN_TEMPLATES[key] || matchPrefixTemplate(key);
  if (tmpl) {
    return direction === 'reduces_risk' || direction === 'neutral' ? tmpl.high : tmpl.low;
  }
  return null;
}

function fallbackLine(f, direction) {
  const label = f.label || naturalLabel(f.feature);
  if (!direction || direction === 'neutral') {
    return `${label} is one of the stronger signals the model used for this score. Compare with the bar chart in “detailed model probabilities” below.`;
  }
  if (direction === 'reduces_risk') {
    return `${label} pulled this assessment toward a more favourable (lower credit-risk) position than you would get if this value were average.`;
  }
  return `${label} added pressure toward a more cautious (higher credit-risk) position in this model’s view.`;
}

function formatValue(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') {
    if (Math.abs(v) < 1 && v !== 0) return v.toFixed(3);
    if (Math.abs(v) < 1000) return v.toFixed(2);
    return Math.round(v).toLocaleString();
  }
  return String(v);
}

function sourceBadge(sat) {
  if (!sat) return null;
  if (sat.sourceKind === 'live') return { cls: 'badge-info', t: 'Live data' };
  if (sat.sourceKind === 'fallback') return { cls: 'badge-medium', t: 'District fallback' };
  if (sat.sourceKind === 'user' || sat.sourceKind === 'edited') return { cls: 'badge-neutral', t: 'Officer entry' };
  return { cls: 'badge-neutral', t: 'On file' };
}

/**
 * @param {object} props
 * @param {Array} props.factors - top factors from model
 * @param {object} [props.confidence] - { dataConfidence, featureCoverage, imputedFeatures? }
 * @param {string[]} [props.readinessWarnings]
 * @param {object} [props.satellite] - environmental row for a short context block
 * @param {string} [props.emptyLabel]
 */
export default function ExplanationPanel({
  factors = [],
  confidence = null,
  readinessWarnings = [],
  satellite = null,
  emptyLabel = 'No driver list was returned for this run. Class probabilities in the card above still apply.',
}) {
  const reducing = factors.filter((f) => f.direction === 'reduces_risk').slice(0, 5);
  const increasing = factors.filter((f) => f.direction === 'increases_risk').slice(0, 5);
  const neutral = factors.filter((f) => !f.direction || f.direction === 'neutral').slice(0, 5);
  const hasDir = reducing.length + increasing.length > 0;
  const src = sourceBadge(satellite);

  return (
    <div className="card explanation-panel">
      <div className="explanation-section">
        <h3 className="explanation-h">Why this result?</h3>
        <p className="explanation-lead text-muted text-sm" style={{ margin: '0 0 var(--space-2)' }}>
          <strong>At a glance:</strong> the Fin-Agri score in the card above comes from a three-way credit-risk model
          (LOW / MEDIUM / HIGH). The lists below name what most pushed this case toward a cautious read vs. a stronger
          read — in language suitable for supervisors and field officers.
        </p>
      </div>

      {!factors.length && (
        <p className="text-muted text-sm" style={{ margin: 0 }}>{emptyLabel}</p>
      )}

      {!!factors.length && hasDir && (
        <div className="explain-cols explain-cols--framed">
          <div className="explain-col increases">
            <div className="explain-col__head">
              <span className="factor-pill factor-pill--risk">Main risk drivers</span>
              <p className="explain-col__sub">What pushed the case toward a more cautious read</p>
            </div>
            {increasing.length === 0 ? (
              <p className="text-muted text-sm" style={{ margin: 0 }}>No single factor stands out on the “more risk” side — check class probabilities for detail.</p>
            ) : (
              <ul className="factor-list">
                {increasing.map((f, i) => (
                  <li key={`i-${i}`} className="factor-list__item">
                    <div className="factor-list__title">{f.label || naturalLabel(f.feature)}</div>
                    <div className="factor-list__val text-muted">Recorded value · {formatValue(f.value)}</div>
                    <p className="factor-list__desc">
                      {plainLine(f.feature, 'increases_risk') || fallbackLine(f, 'increases_risk')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="explain-col reduces">
            <div className="explain-col__head">
              <span className="factor-pill factor-pill--ok">Positive indicators</span>
              <p className="explain-col__sub">What supported a stronger (lower-risk) read</p>
            </div>
            {reducing.length === 0 ? (
              <p className="text-muted text-sm" style={{ margin: 0 }}>No strong “helping” signal on this list — the case may be borderline. Review income and environment.</p>
            ) : (
              <ul className="factor-list">
                {reducing.map((f, i) => (
                  <li key={`r-${i}`} className="factor-list__item">
                    <div className="factor-list__title">{f.label || naturalLabel(f.feature)}</div>
                    <div className="factor-list__val text-muted">Recorded value · {formatValue(f.value)}</div>
                    <p className="factor-list__desc">
                      {plainLine(f.feature, 'reduces_risk') || fallbackLine(f, 'reduces_risk')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!!factors.length && !hasDir && neutral.length > 0 && (
        <div className="explanation-neutral-block">
          <span className="factor-pill factor-pill--neutral">Top signals (importance)</span>
          <ul className="factor-list">
            {neutral.map((f, i) => (
              <li key={i} className="factor-list__item">
                <div className="factor-list__title">{f.label || naturalLabel(f.feature)}</div>
                <div className="factor-list__val text-muted">Value · {formatValue(f.value)}</div>
                <p className="factor-list__desc">
                  {plainLine(f.feature, 'neutral') || fallbackLine(f, 'neutral')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {satellite && (satellite.rainfall90dMm != null || satellite.ndvi90dMean != null || satellite.environmentRisk) && (
        <div className="explanation-env">
          <div className="explanation-section-head">
            <h4 className="explanation-h explanation-h--sm">Environmental snapshot</h4>
            {src && <span className={`badge ${src.cls} explanation-env-badge`}>{src.t}</span>}
          </div>
          <p className="text-muted text-sm" style={{ margin: '0 0 var(--space-2)' }}>
            These inputs feed the agro-environment part of the score. The full table stays in the card beside (or
            below) this panel.
          </p>
          <ul className="explanation-env-list text-sm">
            {satellite.rainfall90dMm != null && (
              <li><strong>90d rain</strong> · {number(satellite.rainfall90dMm, 1)} mm</li>
            )}
            {satellite.ndvi90dMean != null && (
              <li><strong>NDVI mean</strong> · {number(satellite.ndvi90dMean, 3)}</li>
            )}
            {satellite.environmentRisk && (
              <li><strong>Env. risk</strong> · {satellite.environmentRisk}</li>
            )}
            {satellite.confirmedAt && (
              <li className="text-muted">Officer confirmed · {new Date(satellite.confirmedAt).toLocaleString()}</li>
            )}
          </ul>
        </div>
      )}

      {(confidence && (confidence.dataConfidence != null || confidence.featureCoverage != null)) || readinessWarnings.length > 0 ? (
        <div className="explanation-trust">
          <h4 className="explanation-h explanation-h--sm">Input quality &amp; context</h4>
          {confidence && confidence.dataConfidence != null && (
            <div className="explanation-trust-row">
              <span className="text-muted">Data confidence (inputs)</span>
              <span className="font-semibold">{confidence.dataConfidence}%</span>
            </div>
          )}
          {confidence && confidence.featureCoverage != null && (
            <div className="explanation-trust-row">
              <span className="text-muted">Feature coverage in request</span>
              <span className="font-semibold">{Math.round(Number(confidence.featureCoverage) * 100)}%</span>
            </div>
          )}
          {Array.isArray(confidence?.imputedFeatures) && confidence.imputedFeatures.length > 0 && (
            <p className="text-xs text-faint" style={{ margin: 'var(--space-2) 0 0' }}>
              {confidence.imputedFeatures.length} field(s) were missing and were filled by the training pipeline
              (same as offline batch scoring).
            </p>
          )}
          {readinessWarnings.length > 0 && (
            <ul className="explanation-warn-list">
              {readinessWarnings.slice(0, 4).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

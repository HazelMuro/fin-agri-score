import RiskBadge from './RiskBadge';
import { percent } from '../utils/format';
import { buildLendingNarrative } from '../utils/lendingNarrative';

function ringClass(score) {
  if (score >= 700) return 'is-low';
  if (score >= 550) return 'is-medium';
  return 'is-high';
}

export default function ScoreCard({ prediction, meta }) {
  if (!prediction) return null;
  const {
    fin_agri_score,
    risk_band,
    p_low_risk,
    repayment_probability,
    predicted_label,
    recommendation,
    class_probabilities,
  } = prediction;
  const pLow = p_low_risk != null ? p_low_risk : repayment_probability;

  const narrative = buildLendingNarrative({ ...prediction, risk_band, top_factors: prediction?.top_factors });

  const dataConfidence = meta?.dataConfidence;
  const imputedCount = meta?.imputedFeatures?.length ?? 0;
  const totalFeatures = Math.round(
    imputedCount / Math.max(0.001, 1 - (meta?.featureCoverage ?? 0.5))
  );
  const coveragePct =
    meta?.featureCoverage != null ? Math.round(meta.featureCoverage * 100) : null;

  const confidenceBand =
    dataConfidence == null
      ? null
      : dataConfidence >= 80
      ? 'is-ready_to_score'
      : dataConfidence >= 60
      ? 'is-ready_with_warnings'
      : 'is-needs_review';

  return (
    <div className="card card-lg">
      <div className="score-hero">
        <div className={`score-ring ${ringClass(fin_agri_score)}`}>
          <div className="score-num">{fin_agri_score}</div>
          <div className="score-sub">Fin-Agri Score</div>
        </div>

        <div className="score-meta stack">
          <div className="sm-row">
            <RiskBadge band={risk_band} size="lg" />
            <span className="badge badge-info">Predicted: {predicted_label}</span>
            {dataConfidence != null && (
              <span className={`state-pill ${confidenceBand}`} title="How trustworthy are the inputs this score was computed from?">
                Data confidence · {dataConfidence}%
              </span>
            )}
          </div>

          <div className="grid-2" style={{ gap: 20 }}>
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                P (LOW risk class)
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: 'var(--color-navy)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {percent(pLow, 1)}
              </div>
              <div className="text-xs text-faint" style={{ marginTop: 6, maxWidth: 280 }}>
                Model belief for the LOW credit-risk class — not a literal loan default rate.
              </div>
            </div>
            {coveragePct != null && (
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Feature coverage
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: 'var(--color-navy)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {coveragePct}%
                </div>
                <div className="text-xs text-faint">
                  {imputedCount > 0 ? `${imputedCount} of ${totalFeatures} features imputed by the model` : 'All expected features supplied'}
                </div>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 12 }}>
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Committee-style outcome
              </div>
              <p className="rec" style={{ margin: '6px 0 0', fontWeight: 600, color: 'var(--color-navy)' }}>{narrative.decision}</p>
            </div>
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Why this decision
              </div>
              <p className="rec" style={{ margin: '6px 0 0' }}>{narrative.why}</p>
            </div>
            {narrative.riskDrivers?.length > 0 && (
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Main risk drivers
                </div>
                <ul className="text-sm" style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--color-text)' }}>
                  {narrative.riskDrivers.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {narrative.strengths?.length > 0 && (
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Supporting factors
                </div>
                <ul className="text-sm" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {narrative.strengths.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Recommended next steps
              </div>
              <ul className="text-sm" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {narrative.nextSteps.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            {recommendation && (
              <details className="disclosure">
                <summary>One-line model summary (audit)</summary>
                <p className="rec disclosure-body" style={{ margin: 0, paddingTop: 8 }}>{recommendation}</p>
              </details>
            )}
          </div>

          {class_probabilities && (
            <details className="disclosure">
              <summary>Show detailed model probabilities</summary>
              <div className="disclosure-body">
                <div className="stack-sm">
                  {Object.entries(class_probabilities).map(([k, v]) => (
                    <ProbBar key={k} label={k} value={v} />
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      </div>

      {meta && (meta.warnings?.length || meta.imputedFeatures?.length || meta.provenanceSummary) && (
        <details className="disclosure mt-4">
          <summary>
            Input reliability · {meta.warnings?.length || 0} warning{(meta.warnings?.length || 0) === 1 ? '' : 's'}
            {imputedCount > 0 ? ` · ${imputedCount} imputed features` : ''}
          </summary>
          <div className="disclosure-body stack">
            {meta.warnings?.length > 0 && (
              <div className="alert alert-warning">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {meta.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {meta.provenanceSummary && (
              <div>
                <div className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Provenance summary
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {Object.entries(meta.provenanceSummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, count]) => (
                      <span key={k} className={`prov prov-${provCls(k)}`}>
                        {readable(k)} · {count}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {imputedCount > 0 && (
              <div>
                <div className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Features the model had to impute ({imputedCount})
                </div>
                <div className="text-xs text-muted font-mono" style={{ lineHeight: 1.8 }}>
                  {meta.imputedFeatures.join(', ')}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function readable(k) {
  return (
    {
      user: 'User entered',
      user_confirmed: 'Confirmed',
      autofill_live: 'Auto-filled (live)',
      autofill_fallback: 'Auto-filled (fallback)',
      autofill: 'Auto-filled',
      derived: 'Derived',
      derived_from_rainfall: 'Derived',
      edited: 'User edited',
      default: 'Default',
      missing: 'Missing (imputed)',
    }[k] || k
  );
}

function provCls(k) {
  return (
    {
      user: 'user',
      user_confirmed: 'confirmed',
      autofill_live: 'autolive',
      autofill_fallback: 'autofall',
      autofill: 'autolive',
      derived: 'derived',
      derived_from_rainfall: 'derived',
      edited: 'confirmed',
      default: 'default',
      missing: 'missing',
    }[k] || 'derived'
  );
}

function ProbBar({ label, value }) {
  const pct = Math.round(value * 100);
  const color =
    label === 'LOW'
      ? 'var(--color-risk-low)'
      : label === 'HIGH'
      ? 'var(--color-risk-high)'
      : 'var(--color-risk-medium)';
  return (
    <div>
      <div className="flex-between" style={{ fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 600ms ease' }} />
      </div>
    </div>
  );
}

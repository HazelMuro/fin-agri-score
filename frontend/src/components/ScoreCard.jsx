/**
 * ScoreCard v2 — premium visual treatment.
 * - Count-up animation on the Fin-Agri score number
 * - Animated entry (scale-in on ring, fade-up on meta)
 * - Larger metric figures with proper typographic hierarchy
 * - Stronger decision narrative card
 * All existing props / data paths are unchanged.
 */

import { useEffect, useRef, useState } from 'react';
import RiskBadge from './RiskBadge';
import { percent } from '../utils/format';
import { buildLendingNarrative } from '../utils/lendingNarrative';

function ringClass(score) {
  if (score >= 700) return 'is-low';
  if (score >= 550) return 'is-medium';
  return 'is-high';
}

/** Smoothly counts up to `target` over `duration` ms */
function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const fromRef  = useRef(0);

  useEffect(() => {
    if (target == null) return;
    fromRef.current = 0;
    startRef.current = null;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}

export default function ScoreCard({ prediction, meta, farmerName, loanPurpose }) {
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

  const narrative = buildLendingNarrative(
    { ...prediction, risk_band, top_factors: prediction?.top_factors },
    { farmerName, loanPurpose }
  );

  const displayScore = useCountUp(fin_agri_score, 1000);

  const dataConfidence = meta?.dataConfidence;
  const imputedCount = meta?.imputedFeatures?.length ?? 0;
  const totalFeatures = Math.round(
    imputedCount / Math.max(0.001, 1 - (meta?.featureCoverage ?? 0.5))
  );
  const coveragePct =
    meta?.featureCoverage != null ? Math.round(meta.featureCoverage * 100) : null;
  const dashCov = meta?.mappableCoverage;
  const dashPct = dashCov != null ? Math.round(Number(dashCov) * 100) : null;

  const confidenceBand =
    dataConfidence == null
      ? null
      : dataConfidence >= 80
      ? 'is-ready_to_score'
      : dataConfidence >= 60
      ? 'is-ready_with_warnings'
      : 'is-needs_review';

  return (
    <div className="card card-lg anim-fade-up">
      {/* ── Hero: ring + meta ── */}
      <div className="score-hero">
        <div className={`score-ring ${ringClass(fin_agri_score)}`}>
          <div className="score-num">{displayScore}</div>
          <div className="score-sub">Fin-Agri Score</div>
        </div>

        <div className="score-meta stack">
          {/* Badge row */}
          <div className="sm-row">
            <RiskBadge band={risk_band} finAgriScore={fin_agri_score} size="lg" />
            <span className="badge badge-info">Predicted: {predicted_label}</span>
            {dataConfidence != null && (
              <span
                className={`state-pill ${confidenceBand}`}
                title="How trustworthy are the inputs this score was computed from?"
              >
                Data confidence · {dataConfidence}%
              </span>
            )}
          </div>

          {/* Key metrics row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${dashPct != null ? 3 : coveragePct != null ? 2 : 1}, minmax(0, 1fr))`,
              gap: 20,
            }}
          >
            <MetricFigure
              label="Probability of repayment"
              value={percent(pLow, 1)}
              hint="Confidence level that the borrower will repay based on the model's risk class probabilities (P_Low + P_Medium)."
            />
            {coveragePct != null && (
              <MetricFigure
                label="Feature coverage"
                value={`${coveragePct}%`}
                hint={
                  imputedCount > 0
                    ? `${imputedCount} of ${totalFeatures} pipeline columns missing before sklearn (rest imputed)`
                    : 'All pipeline columns supplied in the request'
                }
              />
            )}
            {dashPct != null && meta?.mappableTotal != null && (
              <MetricFigure
                label="Dashboard input coverage"
                value={`${dashPct}%`}
                hint={`${meta.mappableFilled} of ${meta.mappableTotal} app fields mapped into model. Complete steps 2–4 to improve.`}
              />
            )}
          </div>

          {/* Decision narrative card */}
          <div
            className="card"
            style={{
              marginTop: 4,
              padding: '16px 18px',
              background: 'linear-gradient(120deg, var(--color-surface-alt) 0%, var(--color-primary-50) 100%)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="result-section-label" style={{ margin: '0 0 8px' }}>
              Decision narrative{narrative.farmerLabel ? ` · ${narrative.farmerLabel}` : ''}
            </div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: 'var(--color-navy)', lineHeight: 1.45 }}>
              {narrative.headline}
            </p>
            <p className="text-sm" style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
              {narrative.personalizedExplanation}
            </p>
          </div>

          {/* Structured narrative items */}
          <div className="stack" style={{ gap: 12 }}>
            <NarrativeRow label="Committee-style outcome" content={narrative.decision} />
            <NarrativeRow label="Factor summary (model wording)" content={narrative.why} />

            {narrative.riskDrivers?.length > 0 && (
              <div>
                <div className="result-section-label">Main risk drivers</div>
                <ul className="text-sm" style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text)' }}>
                  {narrative.riskDrivers.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}

            {narrative.strengths?.length > 0 && (
              <div>
                <div className="result-section-label">Supporting factors</div>
                <ul className="text-sm" style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text)' }}>
                  {narrative.strengths.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}

            {(narrative.backendRecommendation || recommendation) && (
              <div className="alert alert-info" style={{ margin: 0 }}>
                <div className="result-section-label" style={{ margin: '0 0 6px', color: 'var(--color-info)' }}>
                  Official recommendation (model policy text)
                </div>
                <p className="text-sm" style={{ margin: 0, lineHeight: 1.55 }}>
                  {narrative.backendRecommendation || recommendation}
                </p>
              </div>
            )}

            <div>
              <div className="result-section-label">Suggested committee actions</div>
              <ul className="text-sm" style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text)' }}>
                {narrative.nextSteps.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          </div>

          {/* Collapsible: class probabilities */}
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

      {/* Collapsible: input reliability */}
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
                  {meta.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {meta.provenanceSummary && (
              <div>
                <div className="result-section-label">Provenance summary</div>
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
                <div className="result-section-label">Features the model had to impute ({imputedCount})</div>
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

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricFigure({ label, value, hint }) {
  return (
    <div>
      <div className="result-section-label">{label}</div>
      <div className="score-meta-figure">{value}</div>
      {hint && <div className="text-xs text-faint" style={{ marginTop: 4, maxWidth: 260, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function NarrativeRow({ label, content }) {
  if (!content) return null;
  return (
    <div>
      <div className="result-section-label">{label}</div>
      <p className="rec" style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--color-navy)', lineHeight: 1.5 }}>{content}</p>
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
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </div>
    </div>
  );
}

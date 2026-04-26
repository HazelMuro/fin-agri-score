import { number, date } from '../utils/format';
import ProvenanceBadge from './ProvenanceBadge';

function fieldProvenance(data, field) {
  if (!data || data[field] == null) return 'missing';
  const per = data.provenance?.[field];
  if (per) return per;
  if (data.confirmedAt) return 'user_confirmed';
  if (data.sourceKind === 'user' || data.sourceKind === 'edited') return 'user';
  if (data.sourceKind === 'fallback') return 'autofill_fallback';
  if (data.sourceKind === 'live') return 'autofill_live';
  return 'autofill';
}

export default function EnvironmentalMetrics({ data, showProvenance = true }) {
  if (!data) {
    return (
      <div className="card">
        <h3>Environmental & Agronomic Insights</h3>
        <p className="text-muted">No satellite data recorded for this application.</p>
      </div>
    );
  }

  const items = [
    {
      label: 'Rainfall — last 30 days',
      value: data.rainfall30dMm != null ? `${number(data.rainfall30dMm, 1)} mm` : '—',
      hint: 'Daily precipitation total',
      accent: '#1e6fa8',
      field: 'rainfall30dMm',
    },
    {
      label: 'Rainfall — last 90 days',
      value: data.rainfall90dMm != null ? `${number(data.rainfall90dMm, 1)} mm` : '—',
      hint: 'Rolling 90-day precipitation',
      accent: '#1e6fa8',
      field: 'rainfall90dMm',
    },
    {
      label: 'Vegetation health (NDVI mean)',
      value: data.ndvi90dMean != null ? number(data.ndvi90dMean, 3) : '—',
      hint: 'Higher = healthier canopy',
      accent: 'var(--color-primary)',
      field: 'ndvi90dMean',
    },
    {
      label: 'Vegetation variability (NDVI std)',
      value: data.ndvi90dStd != null ? number(data.ndvi90dStd, 3) : '—',
      hint: 'Higher = less stable vegetation',
      accent: 'var(--color-primary)',
      field: 'ndvi90dStd',
    },
    {
      label: 'Environmental score',
      value: data.environmentScore != null ? number(data.environmentScore, 0) : '—',
      hint: 'Composite agri-environment index',
      accent: 'var(--color-accent-600)',
      field: 'environmentScore',
    },
    {
      label: 'Environmental risk',
      value: data.environmentRisk || '—',
      hint: 'Composite risk classification',
      accent:
        data.environmentRisk === 'Low'
          ? 'var(--color-risk-low)'
          : data.environmentRisk === 'High'
          ? 'var(--color-risk-high)'
          : 'var(--color-risk-medium)',
      field: 'environmentRisk',
    },
  ];

  const sourceBadge = data.sourceKind
    ? data.sourceKind === 'live'
      ? { cls: 'badge-info', label: 'Live · NASA POWER' }
      : data.sourceKind === 'fallback'
      ? { cls: 'badge-medium', label: 'Fallback · district climatology' }
      : data.sourceKind === 'edited'
      ? { cls: 'badge-low', label: 'User-edited' }
      : { cls: 'badge-neutral', label: data.source || 'Unspecified' }
    : { cls: 'badge-neutral', label: data.source || 'Unspecified' };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 style={{ margin: 0 }}>Environmental & Agronomic Insights</h3>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Remote-sensing indicators that frame how the land itself is performing this season.
          </p>
        </div>
        <div className="stack-sm" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
          <span className={`badge ${sourceBadge.cls}`}>{sourceBadge.label}</span>
          <span className="text-xs text-muted">
            {data.confirmedAt
              ? `Confirmed ${date(data.confirmedAt)}`
              : data.observationDate
              ? `Observed ${date(data.observationDate)}`
              : null}
          </span>
        </div>
      </div>

      <div className="grid-3">
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              padding: 14,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${it.accent}`,
              background: 'var(--color-surface)',
            }}
          >
            <div className="flex-between" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div className="text-xs text-muted" style={{ fontWeight: 600 }}>{it.label}</div>
              {showProvenance && (
                <ProvenanceBadge source={fieldProvenance(data, it.field)} compact />
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-navy)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              {it.value}
            </div>
            <div className="text-xs text-faint" style={{ marginTop: 4 }}>{it.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SummaryCard({ label, value, hint, tone = 'default', icon }) {
  const toneColor = {
    default: 'var(--color-navy)',
    primary: 'var(--color-primary)',
    accent: 'var(--color-accent-600)',
    low: 'var(--color-risk-low)',
    medium: 'var(--color-risk-medium)',
    high: 'var(--color-risk-high)',
  }[tone] || 'var(--color-navy)';

  return (
    <div className="card card-tight" style={{ padding: 20 }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-faint)',
              fontWeight: 700,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: toneColor,
              marginTop: 8,
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value ?? '—'}
          </div>
          {hint && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-primary-50)',
              color: 'var(--color-primary)',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

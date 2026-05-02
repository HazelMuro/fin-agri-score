export default function SummaryCard({ label, value, hint, tone = 'default', icon, delayClass }) {
  const toneColor = {
    default: 'var(--color-navy)',
    primary: 'var(--color-primary)',
    accent: 'var(--color-accent-600)',
    low: 'var(--color-risk-low)',
    medium: 'var(--color-risk-medium)',
    high: 'var(--color-risk-high)',
  }[tone] || 'var(--color-navy)';

  return (
    <div className={`card card-tight anim-fade-up ${delayClass || ''}`} style={{ padding: '22px 24px', borderLeft: `4px solid ${toneColor}` }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-faint)',
              fontWeight: 700,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--color-navy)',
              marginTop: 6,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em'
            }}
          >
            {value ?? '—'}
          </div>
          {hint && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, opacity: 0.8 }}>
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-surface-alt)',
              color: toneColor,
              fontSize: 20,
              boxShadow: 'inset 0 0 0 1px var(--color-border)'
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

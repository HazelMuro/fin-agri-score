import { datetime } from '../utils/format';

const ACTION_LABELS = {
  APPLICATION_CREATED: 'Application created',
  APPLICATION_SCORED: 'Credit scoring run',
  STATUS_CHANGED: 'Status updated',
};

export default function AuditLogList({ logs = [] }) {
  if (!logs.length) {
    return <p className="text-muted">No audit activity recorded yet.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {logs.map((log) => (
        <li
          key={log.id}
          style={{
            display: 'flex',
            gap: 14,
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--color-primary-50)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
              {ACTION_LABELS[log.action] || log.action}
            </div>
            <div className="text-xs text-muted">{datetime(log.createdAt)}</div>
            {log.details && (
              <div className="text-xs text-faint font-mono" style={{ marginTop: 4, wordBreak: 'break-word' }}>
                {JSON.stringify(log.details)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

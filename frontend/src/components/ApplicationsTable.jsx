import { useNavigate } from 'react-router-dom';
import { currency, date } from '../utils/format';
import RiskBadge from './RiskBadge';
import TableScroll from './TableScroll';

export default function ApplicationsTable({ applications, showFarmer = true }) {
  const navigate = useNavigate();

  if (!applications.length) {
    return (
      <div className="state-emoji">📄<p>No applications found.</p></div>
    );
  }

  return (
    <TableScroll ariaLabel="Loan applications list" stickyFirstColumn>
      <table className="table">
        <thead>
          <tr>
            <th className="sticky-col">ID</th>
            {showFarmer && <th>Farmer</th>}
            <th>Purpose</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Risk</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} style={{ cursor: 'pointer' }}>
              <td className="sticky-col font-mono text-xs text-muted">{a.id.slice(0, 8)}</td>
              {showFarmer && (
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {a.farmer?.fullName || a.farmerName || '—'}
                  </div>
                  <div className="text-xs text-faint">{a.farmer?.district || a.district || ''}</div>
                </td>
              )}
              <td className="text-sm">{a.purpose}</td>
              <td className="font-mono">{currency(a.amountRequested)}</td>
              <td>
                <StatusBadge status={a.status} />
              </td>
              <td>
                {a.score?.riskBand || a.creditScores?.[0]?.riskBand || a.riskBand ? (
                  <RiskBadge
                    band={a.score?.riskBand || a.creditScores?.[0]?.riskBand || a.riskBand}
                    finAgriScore={a.score?.finAgriScore ?? a.creditScores?.[0]?.finAgriScore}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
              <td className="text-right">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/applications/${a.id}`);
                  }}
                >
                  Open →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function StatusBadge({ status }) {
  const colors = {
    SCORED: 'badge-low',
    PENDING: 'badge-neutral',
    SUBMITTED: 'badge-info',
    REJECTED: 'badge-high',
  };
  return <span className={`badge badge-xs ${colors[status] || 'badge-neutral'}`}>{status}</span>;
}

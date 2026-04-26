import { Link } from 'react-router-dom';
import RiskBadge from './RiskBadge';
import TableScroll from './TableScroll';
import { currency, date } from '../utils/format';

function ReadinessStateBadge({ state }) {
  if (!state) return <span className="badge badge-neutral">Not checked</span>;
  const labels = {
    incomplete: 'Incomplete',
    needs_review: 'Needs review',
    ready_with_warnings: 'Ready w/ warnings',
    ready_to_score: 'Ready to score',
    scored: 'Scored',
  };
  return <span className={`state-pill is-${state}`}>{labels[state] || state}</span>;
}

export default function ApplicationsTable({
  applications = [],
  showFarmer = true,
  readinessByApp = {},
}) {
  if (!applications.length) {
    return (
      <div className="state">
        <div className="state-emoji">📄</div>
        <p>No applications yet.</p>
      </div>
    );
  }
  return (
    <TableScroll ariaLabel="Loan applications table" stickyFirstColumn={showFarmer}>
      <table className="table">
      <thead>
        <tr>
          {showFarmer && <th>Farmer</th>}
          <th>Purpose</th>
          <th>Amount</th>
          <th>Assessment</th>
          <th>Status</th>
          <th>Score</th>
          <th>Risk</th>
          <th>Submitted</th>
          <th className="text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((a) => {
          const latestScore = a.creditScores?.[0] || null;
          const readinessState = readinessByApp?.[a.id]?.state;
          return (
            <tr key={a.id}>
              {showFarmer && (
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {a.farmer?.fullName || a.farmerName || '—'}
                  </div>
                  <div className="text-xs text-faint">{a.farmer?.district || a.district || ''}</div>
                </td>
              )}
              <td>{a.purpose}</td>
              <td className="font-mono">{currency(a.amountRequested)}</td>
              <td>
                <ReadinessStateBadge state={readinessState} />
              </td>
              <td>
                <span className={`badge ${a.status === 'SCORED' ? 'badge-info' : ''}`}>
                  {a.status}
                </span>
              </td>
              <td className="font-mono">
                {latestScore?.finAgriScore ?? a.finAgriScore ?? '—'}
              </td>
              <td>
                <RiskBadge band={latestScore?.riskBand ?? a.riskBand} size="sm" />
              </td>
              <td className="text-xs text-muted">{date(a.createdAt)}</td>
              <td className="text-right">
                <Link className="btn btn-ghost btn-sm" to={`/applications/${a.id}`}>
                  View details
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </TableScroll>
  );
}

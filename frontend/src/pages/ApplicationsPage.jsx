import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ApplicationsTable from '../components/ApplicationsTable';
import { listApplications } from '../services/applications';
import { getReadiness } from '../services/assessment';

import { useAuth } from '../auth/AuthContext';

const VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'ready_with_warnings', label: 'Ready with warnings' },
  { id: 'ready_to_score', label: 'Ready to score' },
  { id: 'scored', label: 'Scored' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'pending', label: 'Pending' },
];

function matchesView(app, readiness, view) {
  if (view === 'all') return true;
  if (view === 'approved') return app.status === 'APPROVED';
  if (view === 'rejected') return app.status === 'REJECTED';
  if (view === 'pending') return app.status === 'PENDING';
  if (view === 'scored') return app.status === 'SCORED';
  if (view === 'incomplete') return readiness?.state === 'incomplete';
  if (view === 'ready_with_warnings') return readiness?.state === 'ready_with_warnings';
  if (view === 'ready_to_score') return readiness?.state === 'ready_to_score';
  return true;
}

function matchesSearch(app, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const farmerName = String(app?.farmer?.fullName || app?.farmerName || '').toLowerCase();
  const district = String(app?.farmer?.district || app?.district || '').toLowerCase();
  const purpose = String(app?.purpose || '').toLowerCase();
  return (
    farmerName.includes(needle) ||
    district.includes(needle) ||
    purpose.includes(needle)
  );
}

export default function ApplicationsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [readinessByApp, setReadinessByApp] = useState({});
  const { user } = useAuth();
  const isDealer = user?.role === 'LOAN_OFFICER';

  useEffect(() => {
    const fid = searchParams.get('farmerId');
    const nu = searchParams.get('new');
    if (fid || nu === '1') {
      const q = new URLSearchParams();
      if (fid) q.set('farmerId', fid);
      navigate(`/applications/new?${q.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const statusParam = ['approved', 'rejected', 'pending', 'scored'].includes(view)
        ? view.toUpperCase()
        : undefined;
      const res = await listApplications(
        statusParam ? { status: statusParam, take: 300 } : { take: 300 }
      );
      const rows = res.items || [];
      setItems(rows);
      const states = await Promise.all(
        rows.map(async (a) => {
          try {
            const r = await getReadiness(a.id);
            return [a.id, r];
          } catch {
            return [a.id, null];
          }
        })
      );
      setReadinessByApp(Object.fromEntries(states));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [view]);

  const filtered = items.filter((app) =>
    matchesView(app, readinessByApp?.[app.id], view) && matchesSearch(app, q)
  );

  const viewCounts = Object.fromEntries(
    VIEWS.map(({ id }) => [
      id,
      items.filter((app) => matchesView(app, readinessByApp?.[app.id], id)).length,
    ])
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan applications</h1>
          <p className="page-subtitle">Review cases, readiness, and decisions in one place.</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Search farmer, district, purpose…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isDealer && (
            <Link className="btn" to="/applications/new">
              + New application
            </Link>
          )}
        </div>
      </div>

      <div className="card card-tight mb-4">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {VIEWS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn btn-sm ${view === f.id ? '' : 'btn-secondary'}`}
              onClick={() => setView(f.id)}
            >
              {f.label} ({viewCounts[f.id] || 0})
            </button>
          ))}
        </div>
        <p className="text-xs text-muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Readiness states come from assessment checks. Decision states come from application status.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>Application queue</h2>
          <span className="badge">{filtered.length} shown</span>
        </div>
        {loading ? (
          <div className="state">
            <div className="spinner" />
          </div>
        ) : (
          <ApplicationsTable applications={filtered} readinessByApp={readinessByApp} />
        )}
      </div>
    </div>
  );
}

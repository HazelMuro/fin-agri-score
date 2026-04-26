import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge';
import { listScores } from '../services/scores';
import { downloadReport, REPORT_DOWNLOADS } from '../services/reports';
import TableScroll from '../components/TableScroll';
import { currency, datetime } from '../utils/format';

const BANDS = ['ALL', 'Low', 'Medium', 'High'];

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState('ALL');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [csvBusy, setCsvBusy] = useState(false);

  const load = async (b = band) => {
    setLoading(true);
    try {
      const res = await listScores(b === 'ALL' ? {} : { riskBand: b });
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(band); /* eslint-disable-next-line */ }, [band]);

  useEffect(() => {
    const needle = q.trim().toLowerCase();
    let rows = items.filter((s) => {
      if (!needle) return true;
      const farmer = (s.application?.farmer?.fullName || '').toLowerCase();
      const district = (s.application?.farmer?.district || '').toLowerCase();
      const purpose = (s.application?.purpose || '').toLowerCase();
      const rec = (s.recommendation || '').toLowerCase();
      return (
        farmer.includes(needle) ||
        district.includes(needle) ||
        purpose.includes(needle) ||
        rec.includes(needle)
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'score_desc') return (b.finAgriScore || 0) - (a.finAgriScore || 0);
      if (sortBy === 'score_asc') return (a.finAgriScore || 0) - (b.finAgriScore || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    setFiltered(rows);
  }, [items, q, sortBy]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Score History</h1>
          <p className="page-subtitle">Every Fin-Agri Score that has been generated for a loan application.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={csvBusy}
            onClick={async () => {
              setCsvBusy(true);
              try {
                await downloadReport(
                  REPORT_DOWNLOADS.scoreHistory.path,
                  REPORT_DOWNLOADS.scoreHistory.filename
                );
              } finally {
                setCsvBusy(false);
              }
            }}
          >
            {csvBusy ? 'Preparing…' : 'Download CSV'}
          </button>
          <input
            className="input"
            style={{ width: 260 }}
            placeholder="Search farmer, district, purpose…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 180 }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score_desc">Highest score</option>
            <option value="score_asc">Lowest score</option>
          </select>
          <select className="select" value={band} onChange={(e) => setBand(e.target.value)} style={{ width: 180 }}>
            {BANDS.map((b) => <option key={b}>{b === 'ALL' ? 'All risk bands' : `${b} risk`}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0 }}>All scoring runs</h2>
          <span className="badge">{filtered.length}</span>
        </div>
        {loading ? (
          <div className="state"><div className="spinner" /></div>
        ) : filtered.length ? (
          <TableScroll ariaLabel="Scoring runs" stickyFirstColumn>
            <table className="table">
              <thead>
                <tr>
                  <th>Scored at</th>
                  <th>Farmer</th>
                  <th>Purpose</th>
                  <th>Amount</th>
                  <th>Fin-Agri Score</th>
                  <th>Risk band</th>
                  <th>Recommendation</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="text-xs text-muted">{datetime(s.createdAt)}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                        {s.application?.farmer?.fullName || '—'}
                      </div>
                      <div className="text-xs text-faint">{s.application?.farmer?.district || ''}</div>
                    </td>
                    <td>{s.application?.purpose}</td>
                    <td className="font-mono">{currency(s.application?.amountRequested)}</td>
                    <td className="font-mono font-bold" style={{ color: 'var(--color-navy)' }}>{s.finAgriScore}</td>
                    <td><RiskBadge band={s.riskBand} size="sm" /></td>
                    <td style={{ maxWidth: 320, fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {String(s.recommendation || '').slice(0, 80)}{s.recommendation?.length > 80 ? '…' : ''}
                    </td>
                    <td className="text-right">
                      <Link to={`/applications/${s.applicationId}`} className="btn btn-ghost btn-sm">Open →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <div className="state">
            <div className="state-emoji">🗂️</div>
            <p>No scored applications yet. Go to <Link to="/score">Score application</Link> to run your first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

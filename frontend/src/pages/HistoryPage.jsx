import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge';
import { listScores } from '../services/scores';
import { downloadReport, REPORT_DOWNLOADS } from '../services/reports';
import TableScroll from '../components/TableScroll';
import { currency, datetime } from '../utils/format';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function FarmerTimeline({ scores, farmerName, onBack, loading }) {
  if (loading) {
    return (
      <div className="page state">
        <div className="spinner" />
        <p className="text-muted text-sm mt-3">Loading assessment timeline…</p>
      </div>
    );
  }

  const data = [...scores]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((s) => ({
      date: new Date(s.createdAt).toLocaleDateString(),
      score: s.finAgriScore,
      purpose: s.application?.purpose || 'N/A',
      season: s.application?.season || '',
    }));

  if (!scores.length) {
    return (
      <div className="page anim-fade-up">
        <button className="btn btn-ghost btn-sm mb-4" onClick={onBack}>← Back to all history</button>
        <h2 style={{ margin: 0 }}>Score timeline · {farmerName}</h2>
        <p className="text-muted text-sm mt-2">No Fin-Agri Score records were returned for this farmer.</p>
      </div>
    );
  }

  return (
    <div className="anim-fade-up">
      <div className="flex-between mb-4">
        <div>
          <button className="btn btn-ghost btn-sm mb-2" onClick={onBack}>← Back to all history</button>
          <h2 style={{ margin: 0 }}>Score timeline · {farmerName}</h2>
          <p className="text-muted text-sm" style={{ marginTop: 6 }}>
            Fin-Agri Scores across seasons and applications for this farmer.
          </p>
        </div>
      </div>
      <div className="card" style={{ height: 400, padding: '20px 10px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
            <YAxis domain={[300, 850]} tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="card" style={{ padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
                      <div style={{ fontWeight: 700 }}>{d.date}</div>
                      <div>Score: <strong style={{ color: 'var(--color-primary)' }}>{d.score}</strong></div>
                      <div className="text-muted">Purpose: {d.purpose}</div>
                      {d.season ? <div className="text-muted">Season: {d.season}</div> : null}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              name="Fin-Agri Score"
              type="monotone"
              dataKey="score"
              stroke="var(--color-primary)"
              strokeWidth={3}
              dot={{ r: 6, fill: 'var(--color-primary)' }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const BANDS = ['ALL', 'Low', 'Medium', 'High'];

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState('ALL');
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [csvBusy, setCsvBusy] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState(null);
  const [timelineScores, setTimelineScores] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

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
    if (!selectedFarmerId) {
      setTimelineScores([]);
      return undefined;
    }
    let cancelled = false;
    setTimelineLoading(true);
    listScores({ take: 500 })
      .then((res) => {
        if (!cancelled) setTimelineScores(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setTimelineScores([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFarmerId]);

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

  if (selectedFarmerId) {
    const farmerScores = timelineScores.filter((s) => s.application?.farmer?.id === selectedFarmerId);
    const farmerName =
      farmerScores[0]?.application?.farmer?.fullName ||
      filtered.find((s) => s.application?.farmer?.id === selectedFarmerId)?.application?.farmer?.fullName ||
      'Farmer';
    return (
      <div className="page">
        <FarmerTimeline
          scores={farmerScores}
          farmerName={farmerName}
          loading={timelineLoading}
          onBack={() => setSelectedFarmerId(null)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assessment History</h1>
          <p className="page-subtitle">Past scoring runs; open a farmer to see their score timeline across seasons.</p>
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
                      <div 
                        style={{ fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer' }}
                        onClick={() => setSelectedFarmerId(s.application?.farmer?.id)}
                        title="View score timeline"
                      >
                        {s.application?.farmer?.fullName || '—'}
                      </div>
                      <div className="text-xs text-faint">{s.application?.farmer?.district || ''}</div>
                    </td>
                    <td>{s.application?.purpose}</td>
                    <td className="font-mono">{currency(s.application?.amountRequested)}</td>
                    <td className="font-mono font-bold" style={{ color: 'var(--color-navy)' }}>{s.finAgriScore}</td>
                    <td><RiskBadge band={s.riskBand} finAgriScore={s.finAgriScore} size="sm" /></td>
                    <td style={{ maxWidth: 320, fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {String(s.recommendation || '').slice(0, 80)}{s.recommendation?.length > 80 ? '…' : ''}
                    </td>
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        <Link to={`/scores/${s.id}`} className="btn btn-sm">View result →</Link>
                        <Link to={`/applications/${s.applicationId}`} className="btn btn-ghost btn-sm">Application</Link>
                      </div>
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

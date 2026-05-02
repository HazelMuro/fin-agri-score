/**
 * Home dashboard: KPI cards, portfolio risk donut, monthly trend chart, recent applications table.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import SummaryCard from '../components/SummaryCard';
import ApplicationsTable from '../components/ApplicationsTable';
import { useApi } from '../hooks/useApi';
import { getOverview, getScoreHistory } from '../services/dashboard';
import { Link } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge';
import { datetime } from '../utils/format';
import TableScroll from '../components/TableScroll';

const RISK_COLORS = {
  Low: 'var(--color-risk-low)',
  Medium: 'var(--color-risk-medium)',
  High: 'var(--color-risk-high)',
};

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text)',
  },
  labelStyle: { color: 'var(--color-text-muted)' },
  itemStyle: { color: 'var(--color-text-muted)' },
};

const CHART_LEGEND_PROPS = {
  wrapperStyle: { paddingTop: 10, color: 'var(--color-text-muted)', fontSize: 12 },
};

export default function DashboardPage() {
  const { data, loading, error } = useApi(getOverview, { immediate: true });
  const {
    data: scoreHistory,
    loading: scoreHistoryLoading,
  } = useApi(() => getScoreHistory(6), { immediate: true });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio overview</h1>
          <p className="page-subtitle">Applications, scoring activity, and risk at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/farmers/new" className="btn btn-secondary">+ New farmer</Link>
          <Link to="/applications/new" className="btn">+ New application</Link>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--color-risk-high)', color: 'var(--color-risk-high)' }}>{error}</div>}
      {loading && <div className="state"><div className="spinner" /><p style={{ marginTop: 12 }}>Loading overview…</p></div>}

      {data && (
        <>
          <HeroBand data={data} />

          <div className="grid-4 mb-6">
            <SummaryCard label="Registered farmers" value={data.totals.farmers} icon="👥" tone="primary" delayClass="anim-d1" />
            <SummaryCard label="Loan applications" value={data.totals.applications} icon="📄" tone="default" delayClass="anim-d2" />
            <SummaryCard label="Scored applications" value={data.totals.scoredApplications} icon="🎯" tone="accent" delayClass="anim-d3" />
            <SummaryCard label="Average Fin-Agri Score" value={data.totals.avgFinAgriScore || '—'} icon="★" tone="primary" hint="across all scored loans" delayClass="anim-d4" />
          </div>

          <div className="grid-2 mb-6 anim-fade-up anim-d1">
            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0 }}>Monthly flow</h2>
                <span className="badge badge-neutral">Last 6 months</span>
              </div>
              <MonthlyTrendChart points={data.monthlyTrend || []} />
            </div>

            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0 }}>Portfolio risk distribution</h2>
                <span className="badge badge-info">{data.totals.scoredApplications} scored</span>
              </div>
              <RiskDistributionChart distribution={data.riskDistribution} />
            </div>
          </div>

          <div className="grid-2 mb-6 anim-fade-up anim-d2">
            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0 }}>Risk breakdown</h2>
              </div>
              <div className="stack-sm">
                <RiskRow label="Low risk" count={data.riskDistribution.Low} total={data.totals.scoredApplications} color={RISK_COLORS.Low} />
                <RiskRow label="Medium risk" count={data.riskDistribution.Medium} total={data.totals.scoredApplications} color={RISK_COLORS.Medium} />
                <RiskRow label="High risk" count={data.riskDistribution.High} total={data.totals.scoredApplications} color={RISK_COLORS.High} />
              </div>
              <p className="text-xs text-muted mt-4" style={{ marginBottom: 0 }}>
                Low-risk applications meet approval thresholds cleanly. Medium-risk cases should be approved with mitigants. High-risk cases warrant manual review.
              </p>
            </div>

            <AttentionPanel attention={data.attention || {}} />
          </div>

          <div className="card">
            <div className="card-header">
              <h2 style={{ margin: 0 }}>Recent loan applications</h2>
              <Link to="/applications" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <ApplicationsTable applications={data.recentApplications} />
          </div>

          <div className="card mt-6">
            <div className="card-header">
              <h2 style={{ margin: 0 }}>Recent score activity</h2>
              <div className="flex gap-2">
            <Link to="/reports" className="btn btn-ghost btn-sm">
              Reports
            </Link>
            <Link to="/history" className="btn btn-ghost btn-sm">
              Score history →
            </Link>
          </div>
            </div>
            {scoreHistoryLoading ? (
              <div className="state"><div className="spinner" /></div>
            ) : (
              <RecentScoreActivity items={scoreHistory?.items || []} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RecentScoreActivity({ items }) {
  if (!items.length) {
    return (
      <div className="state">
        <div className="state-emoji">🧭</div>
        <p>No score activity yet. Score an application to start building explainable lending history.</p>
      </div>
    );
  }
  return (
    <TableScroll ariaLabel="Recent score activity" stickyFirstColumn>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Farmer</th>
            <th>Score</th>
            <th>Risk</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td className="text-xs text-muted">{datetime(s.createdAt)}</td>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                  {s.application?.farmer?.fullName || '—'}
                </div>
                <div className="text-xs text-faint">{s.application?.farmer?.district || ''}</div>
              </td>
              <td className="font-mono font-bold">{s.finAgriScore}</td>
              <td><RiskBadge band={s.riskBand} finAgriScore={s.finAgriScore} size="sm" /></td>
              <td className="text-sm text-muted">
                {String(s.recommendation || '').slice(0, 95)}
                {String(s.recommendation || '').length > 95 ? '…' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function HeroBand({ data }) {
  const a = data.attention || {};
  return (
    <div
      className="card mb-6 anim-fade-up"
      style={{
        background: 'linear-gradient(135deg, var(--color-sidebar-bg) 0%, var(--color-navy-600) 100%)',
        color: '#fff',
        border: 'none',
        padding: '32px 36px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex-between" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 500 }}>
            <h2 style={{ color: '#fff', fontSize: 24, margin: 0 }}>Lending operations</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              You have {a.pendingApplications || 0} applications in the pipeline. 
              {a.unscoredApplications > 0 ? ` ${a.unscoredApplications} are awaiting their first credit assessment.` : ' Your scoring queue is currently clear.'}
            </p>
            <div className="flex gap-3 mt-6">
              <Link to="/score" className="btn btn-lg" style={{ background: '#fff', color: 'var(--color-primary)' }}>
                Run scoring wizard →
              </Link>
              <Link to="/applications" className="btn btn-lg btn-ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                Review queue
              </Link>
            </div>
          </div>

          <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
            <HeroMetric label="Pending" value={a.pendingApplications || 0} />
            <HeroMetric label="Awaiting Score" value={a.unscoredApplications || 0} />
            <HeroMetric label="High Risk (30d)" value={a.highRiskRecent || 0} tone="danger" />
          </div>
        </div>
      </div>
      
      {/* Visual flair */}
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 240, height: 240,
        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
    </div>
  );
}

function HeroMetric({ label, value, tone }) {
  const color = tone === 'danger' ? '#fca5a5' : '#fff';
  return (
    <div style={{ textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{label}</div>
    </div>
  );
}

function AttentionPanel({ attention }) {
  const rows = [
    {
      label: 'Pending decisions',
      value: attention.pendingApplications || 0,
      tone: 'var(--color-risk-medium)',
      hint: 'Applications still in PENDING status',
    },
    {
      label: 'Awaiting first score',
      value: attention.unscoredApplications || 0,
      tone: 'var(--color-info)',
      hint: 'Applications without any saved score run',
    },
    {
      label: 'High-risk in last 30 days',
      value: attention.highRiskRecent || 0,
      tone: 'var(--color-risk-high)',
      hint: 'Recent cases requiring tighter review',
    },
    {
      label: 'Submitted in last 30 days',
      value: attention.recentlySubmittedApplications || 0,
      tone: 'var(--color-risk-low)',
      hint: 'Pipeline intake volume',
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h2 style={{ margin: 0 }}>Attention needed</h2>
        <Link to="/applications" className="btn btn-ghost btn-sm">
          Open queue →
        </Link>
      </div>
      <div className="stack-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'var(--color-surface-alt)',
            }}
          >
            <div className="flex-between">
              <span style={{ color: 'var(--color-navy)', fontWeight: 600 }}>{row.label}</span>
              <span className="font-mono font-bold" style={{ color: row.tone }}>
                {row.value}
              </span>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {row.hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskDistributionChart({ distribution }) {
  const total = (distribution.Low || 0) + (distribution.Medium || 0) + (distribution.High || 0);
  if (total === 0) {
    return (
      <div className="state">
        <div className="state-emoji">📉</div>
        <p>No scored applications yet. Score your first application to populate this chart.</p>
      </div>
    );
  }

  const data = [
    { name: 'Low risk', value: distribution.Low || 0, color: RISK_COLORS.Low },
    { name: 'Medium risk', value: distribution.Medium || 0, color: RISK_COLORS.Medium },
    { name: 'High risk', value: distribution.High || 0, color: RISK_COLORS.High },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ width: '100%', height: 280, position: 'relative' }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={70}
            outerRadius={105}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip {...CHART_TOOLTIP_PROPS} />
          <Legend verticalAlign="bottom" height={36} {...CHART_LEGEND_PROPS} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute',
        top: '44%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Total</div>
      </div>
    </div>
  );
}

function MonthlyTrendChart({ points }) {
  if (!points.length) {
    return (
      <div className="state">
        <div className="state-emoji">🗓️</div>
        <p>Monthly trend data will appear once applications and scores accumulate.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScored" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-info)" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="var(--color-info)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: 'var(--color-text-faint)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-faint)', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip {...CHART_TOOLTIP_PROPS} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
          <Legend {...CHART_LEGEND_PROPS} verticalAlign="top" align="right" />
          <Area
            type="monotone"
            dataKey="applications"
            name="Applications"
            stroke="var(--color-info)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorApps)"
            animationDuration={1500}
          />
          <Area
            type="monotone"
            dataKey="scored"
            name="Scored"
            stroke="var(--color-primary)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorScored)"
            animationDuration={1800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RiskRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{label}</span>
        <span className="text-sm text-muted font-mono">{count} · {pct}%</span>
      </div>
      <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 500ms ease' }} />
      </div>
    </div>
  );
}

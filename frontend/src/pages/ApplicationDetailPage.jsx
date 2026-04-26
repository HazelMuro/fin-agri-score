import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { downloadPdf, downloadReport, applicationSummaryPath, applicationSummaryPdfPath } from '../services/reports';
import AuditLogList from '../components/AuditLogList';
import EnvironmentalMetrics from '../components/EnvironmentalMetrics';
import ExplanationPanel from '../components/ExplanationPanel';
import ArtifactXaiPanel from '../components/ArtifactXaiPanel';
import RiskBadge from '../components/RiskBadge';
import ScoreCard from '../components/ScoreCard';
import ReadinessChecklist from '../components/ReadinessChecklist';
import TableScroll from '../components/TableScroll';
import { useApi } from '../hooks/useApi';
import { getApplication } from '../services/applications';
import { getReadiness } from '../services/assessment';
import { getXaiOverview, getXaiFeatureImportance, getXaiSampleExplanations } from '../services/xai';
import { currency, date, datetime } from '../utils/format';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [flash] = useState(() => location.state?.flash ?? null);

  useEffect(() => {
    if (location.state?.flash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const { data: app, loading, error } = useApi(() => getApplication(id), { deps: [id] });
  const { data: xaiOverview } = useApi(() => getXaiOverview(10), { immediate: true });
  const { data: xaiFeatureImportance } = useApi(() => getXaiFeatureImportance(10, 0), { immediate: true });
  const { data: xaiSamples } = useApi(() => getXaiSampleExplanations(2, 0), { immediate: true });
  const [readiness, setReadiness] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPdfBusy, setExportPdfBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    if (!id) return;
    getReadiness(id).then(setReadiness).catch(() => setReadiness(null));
  }, [id]);

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (error) return <div className="page"><div className="card" style={{ color: 'var(--color-risk-high)' }}>{error}</div></div>;
  if (!app) return null;

  const latestScore = app.creditScores?.[0];
  const prediction = latestScore
    ? {
        fin_agri_score: latestScore.finAgriScore,
        risk_band: latestScore.riskBand,
        p_low_risk: latestScore.repaymentProbability,
        predicted_label: latestScore.predictedLabel,
        recommendation: latestScore.recommendation,
        class_probabilities: latestScore.classProbabilities,
        top_factors: latestScore.topFactors,
      }
    : null;
  const readinessStateLabel = readiness?.state ? readiness.state.replace(/_/g, ' ') : 'not checked';
  const primaryAction = !readiness
    ? { label: 'Check assessment readiness', link: `/score?applicationId=${app.id}` }
    : !readiness.canScore
    ? { label: 'Complete assessment', link: `/score?applicationId=${app.id}` }
    : readiness.state === 'scored'
    ? { label: 'Review score history', link: '/history' }
    : { label: 'Run scoring', link: `/score?applicationId=${app.id}` };

  return (
    <div className="page">
      {flash ? (
        <div className="banner is-ok mb-4" role="status">
          {flash}
        </div>
      ) : null}
      {exportError ? (
        <div className="alert alert-danger mb-4" role="alert">
          {exportError}
        </div>
      ) : null}
      <div className="page-header">
        <div>
          <Link to="/applications" className="text-sm text-muted">← Back to applications</Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Loan Application · {app.purpose}
          </h1>
          <p className="page-subtitle">
            Submitted {date(app.createdAt)} · {currency(app.amountRequested)} · {app.season || '—'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <RiskBadge band={latestScore?.riskBand} size="lg" />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exportBusy}
            onClick={async () => {
              setExportError(null);
              setExportBusy(true);
              try {
                await downloadReport(
                  applicationSummaryPath(app.id),
                  `finagri-application-${app.id.slice(0, 8)}.csv`
                );
              } catch (e) {
                setExportError(e.friendlyMessage || 'Export failed.');
              } finally {
                setExportBusy(false);
              }
            }}
          >
            {exportBusy ? 'Exporting…' : 'Export case CSV'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exportPdfBusy}
            onClick={async () => {
              setExportError(null);
              setExportPdfBusy(true);
              try {
                await downloadPdf(
                  applicationSummaryPdfPath(app.id),
                  `finagri-application-${app.id.slice(0, 8)}.pdf`
                );
              } catch (e) {
                setExportError(e.friendlyMessage || 'PDF export failed.');
              } finally {
                setExportPdfBusy(false);
              }
            }}
          >
            {exportPdfBusy ? 'PDF…' : 'Export case PDF'}
          </button>
          <Link to="/reports" className="btn btn-secondary">
            Reports
          </Link>
          <Link to={`/score?applicationId=${app.id}`} className="btn">
            {latestScore ? 'Re-score' : 'Score now'}
          </Link>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex-between" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Case status summary</h2>
            <p className="text-sm text-muted" style={{ marginTop: 6, marginBottom: 0 }}>
              Readiness: <strong>{readinessStateLabel}</strong>
              {readiness ? ` · Completeness ${readiness.completeness}% · Confidence ${readiness.confidence}%` : ''}
              {' · '}Application status <strong>{app.status}</strong>
            </p>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <Link to={primaryAction.link} className="btn">
              {primaryAction.label}
            </Link>
            <Link to={`/farmers/${app.farmerId}`} className="btn btn-secondary">
              Open farmer profile
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-3 mb-6">
        <div className="card">
          <h3>Farmer</h3>
          <InfoRow label="Name" value={app.farmer?.fullName} />
          <InfoRow label="District" value={app.farmer?.district} />
          <InfoRow label="Phone" value={app.farmer?.phone} />
          <InfoRow label="Farm size" value={app.farmer?.farmSizeHa ? `${app.farmer.farmSizeHa} ha` : '—'} />
          <Link to={`/farmers/${app.farmerId}`} className="btn btn-ghost btn-sm mt-3">Open profile →</Link>
        </div>
        <div className="card">
          <h3>Application</h3>
          <InfoRow label="Status" value={app.status} />
          <InfoRow label="Amount" value={currency(app.amountRequested)} />
          <InfoRow label="Purpose" value={app.purpose} />
          <InfoRow label="Season" value={app.season} />
          <InfoRow label="Submitted" value={datetime(app.createdAt)} />
        </div>
        <div className="card">
          <h3>Latest score</h3>
          {latestScore ? (
            <>
              <InfoRow label="Fin-Agri Score" value={latestScore.finAgriScore} />
              <InfoRow label="Risk band" value={latestScore.riskBand} />
              <InfoRow label="Predicted label" value={latestScore.predictedLabel} />
              <InfoRow label="P (LOW class)" value={`${Math.round(latestScore.repaymentProbability * 100)}%`} />
              <InfoRow label="Model" value={latestScore.modelVersion} />
              <InfoRow label="Saved" value={datetime(latestScore.createdAt)} />
            </>
          ) : (
            <p className="text-muted text-sm">Not scored yet.</p>
          )}
        </div>
      </div>

      {readiness && (
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>Assessment readiness</h3>
              <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
                Completeness is about whether fields have values. Confidence is about whether the values came from verified, user-entered data.
              </p>
            </div>
            <span className={`state-pill is-${readiness.state}`}>
              {readiness.state.replace(/_/g, ' ')}
            </span>
          </div>
          <ReadinessChecklist readiness={readiness} />
          {!readiness.canScore && (
            <div className="mt-3">
              <Link to={`/score?applicationId=${app.id}`} className="btn">
                Complete assessment →
              </Link>
            </div>
          )}
          {readiness.canScore && readiness.state !== 'scored' && (
            <div className="mt-3">
              <Link to={`/score?applicationId=${app.id}`} className="btn">
                Run scoring →
              </Link>
            </div>
          )}
        </div>
      )}

      {prediction && (
        <>
          <div className="mb-6">
            <ScoreCard prediction={prediction} />
          </div>

          <div className="grid-2 layout-explain-split mb-6">
            <ExplanationPanel
              factors={prediction.top_factors || []}
              readinessWarnings={readiness?.warnings || []}
              satellite={app.satelliteData?.[0]}
            />
            <EnvironmentalMetrics data={app.satelliteData?.[0]} />
          </div>
          <div className="mb-6">
            <ArtifactXaiPanel
              overview={xaiOverview}
              featureImportance={xaiFeatureImportance?.items || []}
              sampleExplanations={xaiSamples?.items || []}
            />
          </div>
          <div className="card mb-6">
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Decision actions</h3>
                <p className="text-muted text-sm" style={{ marginBottom: 0 }}>
                  Use this score in committee review, then download artifacts from Reports.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/history" className="btn btn-secondary">Open score history</Link>
                <Link to="/reports" className="btn">Open reports center</Link>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Score history</h3>
          {app.creditScores?.length ? (
            <TableScroll ariaLabel="Score history for this application" stickyFirstColumn={false}>
              <table className="table">
                <thead><tr><th>Date</th><th>Score</th><th>Band</th><th>Label</th><th>Model</th></tr></thead>
                <tbody>
                  {app.creditScores.map((s) => (
                    <tr key={s.id}>
                      <td className="text-xs text-muted">{datetime(s.createdAt)}</td>
                      <td className="font-mono">{s.finAgriScore}</td>
                      <td><RiskBadge band={s.riskBand} size="sm" /></td>
                      <td>{s.predictedLabel}</td>
                      <td className="text-xs text-muted">{s.modelVersion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : (
            <p className="text-muted text-sm">No scoring runs yet.</p>
          )}
        </div>
        <div className="card">
          <h3>Audit trail</h3>
          <AuditLogList logs={app.auditLogs || []} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex-between" style={{ padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-navy)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

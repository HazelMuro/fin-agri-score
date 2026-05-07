/**
 * ScoreResultPage — standalone persistent result view at /scores/:id
 *
 * Loads a saved credit score by ID from GET /api/scores/:id and assembles
 * a complete, shareable result page:
 *   - Verdict banner (risk band + recommendation headline)
 *   - Score hero card (ScoreCard component)
 *   - Explanation panel (ExplanationPanel component)
 *   - Environmental snapshot
 *   - Farmer & application summary
 *   - Audit trail / saved timestamp
 *   - Download / export actions
 *
 * This page can be navigated to at any time — it loads from the database,
 * not from React session state. Perfect for presentation and review.
 */

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

import ScoreCard from '../components/ScoreCard';
import ExplanationPanel from '../components/ExplanationPanel';
import RiskBadge from '../components/RiskBadge';

import { getScore } from '../services/scores';
import { updateApplicationStatus } from '../services/applications';
import { downloadPdf, applicationSummaryPdfPath, downloadReport, applicationSummaryPath } from '../services/reports';
import { currency, date, datetime, initials } from '../utils/format';
import { displayRiskBand } from '../utils/userManualDisplay';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ringClass(score) {
  if (score >= 700) return 'is-low';
  if (score >= 550) return 'is-medium';
  return 'is-high';
}

function verdictIcon(band) {
  const b = String(band || '').toLowerCase();
  if (b.startsWith('low'))  return '✅';
  if (b.startsWith('med'))  return '⚠️';
  if (b.startsWith('high')) return '🔴';
  return '📊';
}

function riskBandText(band, finAgriScore) {
  const label = displayRiskBand(band, finAgriScore);
  if (!label) return band || 'Unknown';
  if (label === 'Low') return 'Low risk — favourable for approval';
  if (label === 'Moderate') return 'Moderate risk — review with mitigants';
  if (label === 'High') return 'High risk — manual review required';
  if (label === 'Very High') return 'Very high risk — manual review required';
  return `${label} risk — review required`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScoreResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [score, setScore]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const [pdfBusy, setPdfBusy]   = useState(false);
  const [csvBusy, setCsvBusy]   = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [decisionLogged, setDecisionLogged] = useState(null);

  const handleDecision = async (status) => {
    if (!appId) return;
    setDecisionBusy(true);
    setExportError(null);
    try {
      await updateApplicationStatus(appId, status);
      setDecisionLogged(status);
    } catch (e) {
      setExportError(e.friendlyMessage || 'Failed to record decision.');
    } finally {
      setDecisionBusy(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    getScore(id)
      .then((s) => setScore(s))
      .catch((e) => setError(e.friendlyMessage || 'Could not load score result. Check the ID and try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="state" style={{ paddingTop: 80 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 4 }} />
          <p style={{ marginTop: 16 }}>Loading score result…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card anim-fade-up" style={{ marginTop: 40, borderColor: 'var(--color-risk-high-border)' }}>
          <div className="state-emoji">⚠️</div>
          <h2 style={{ marginTop: 8 }}>Unable to load result</h2>
          <p className="text-muted">{error}</p>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Go back</button>
            <Link to="/history" className="btn">View score history</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!score) return null;

  const application  = score.application || {};
  const farmer       = application.farmer || {};
  const satellite    = application.satelliteData?.[0] || null;
  const factors      = score.topFactors || score.top_factors || [];
  const prediction   = score.prediction || buildPredictionFromScore(score);
  const meta         = score.meta || score.confidence || null;
  const warnings     = score.readinessWarnings || [];
  const appId        = score.applicationId || application.id;
  const bandClass    = ringClass(score.finAgriScore);
  const bandLower    = String(score.riskBand || '').toLowerCase().split(' ')[0] || 'medium';

  const handlePdf = async () => {
    if (!appId) return;
    setPdfBusy(true);
    setExportError(null);
    try {
      await downloadPdf(applicationSummaryPdfPath(appId), `finagri-result-${appId.slice(0, 8)}.pdf`);
    } catch (e) {
      setExportError(e.friendlyMessage || 'PDF export failed. Is the API running?');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleCsv = async () => {
    if (!appId) return;
    setCsvBusy(true);
    setExportError(null);
    try {
      await downloadReport(applicationSummaryPath(appId), `finagri-result-${appId.slice(0, 8)}.csv`);
    } catch (e) {
      setExportError(e.friendlyMessage || 'CSV export failed. Is the API running?');
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <div className="page">
      {decisionLogged && (
        <div className="banner is-ok mb-4">
          Decision "{decisionLogged}" logged successfully to the audit trail.
        </div>
      )}

      {/* ── Page header ── */}
      <div className="page-header anim-fade-in">
        <div>
          <Link to="/history" className="text-sm text-muted">← Back to score history</Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>Score Result</h1>
          <p className="page-subtitle">
            {farmer.fullName ? `${farmer.fullName} · ` : ''}
            {application.purpose ? `${application.purpose} · ` : ''}
            {application.amountRequested ? currency(application.amountRequested) : ''}
          </p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {appId && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={csvBusy}
                onClick={handleCsv}
              >
                {csvBusy ? 'Preparing…' : 'Export CSV'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pdfBusy}
                onClick={handlePdf}
              >
                {pdfBusy ? 'PDF…' : 'Export PDF'}
              </button>
              <Link to={`/applications/${appId}`} className="btn btn-secondary">
                View application
              </Link>
            </>
          )}
          {farmer.id && (
            <Link to={`/farmers/${farmer.id}`} className="btn btn-secondary">
              Farmer profile
            </Link>
          )}
          <Link to="/score" className="btn">
            Score another
          </Link>
        </div>
      </div>

      {exportError && (
        <div className="alert alert-danger mb-4">{exportError}</div>
      )}

      {/* ── Verdict banner ── */}
      <div className={`verdict-banner is-${bandLower} mb-6`}>
        <span className="verdict-icon">{verdictIcon(score.riskBand)}</span>
        <div className="verdict-text">
          <strong>{riskBandText(score.riskBand, score.finAgriScore)}</strong>
          <br />
          <span className="text-sm">
            Fin-Agri Score <strong style={{ color: 'var(--color-navy)' }}>{score.finAgriScore}</strong> ·{' '}
            Scored {datetime(score.createdAt)} · Score ID <span className="font-mono text-xs">{score.id?.slice(0, 8)}</span>
          </span>
        </div>
        <RiskBadge band={score.riskBand} finAgriScore={score.finAgriScore} size="lg" />
      </div>

      {/* ── Main 2-column grid: score card + context ── */}
      <div className="stack">

        {/* Score card (full width — it's the centrepiece) */}
        <div className="anim-fade-up anim-d1">
          <ScoreCard
            prediction={prediction}
            meta={meta}
            farmerName={farmer.fullName}
            loanPurpose={application.purpose}
          />
        </div>

        {/* ── Explanation + Environmental (2 column on wide screens) ── */}
        <div className="grid-2 anim-fade-up anim-d2">
          <ExplanationPanel
            factors={factors}
            confidence={meta}
            readinessWarnings={warnings}
            satellite={satellite}
          />

          {/* Environmental snapshot card */}
          <div className="stack" style={{ gap: 16 }}>
            {satellite && (
              <div className="card anim-fade-up anim-d3">
                <div className="card-header">
                  <h3 style={{ margin: 0 }}>Environmental context</h3>
                  <SourceBadge sat={satellite} />
                </div>
                <div className="kv-grid">
                  <EnvKV label="Recent Rainfall (30d)"   value={satellite.rainfall30dMm != null ? `${satellite.rainfall30dMm} mm` : '—'} />
                  <EnvKV label="Seasonal Rainfall (90d)" value={satellite.rainfall90dMm != null ? `${satellite.rainfall90dMm} mm` : '—'} />
                  <EnvKV label="Crop Health Index"      value={satellite.ndvi90dMean?.toFixed(3)}  />
                  <EnvKV label="Growth Stability"       value={satellite.ndvi90dStd?.toFixed(3)}   />
                  <EnvKV label="Environmental Resilience" value={satellite.environmentScore} />
                  <EnvKV label="Agro-Climate Risk"      value={satellite.environmentRisk}  />
                </div>
                {satellite.confirmedAt && (
                  <div className="banner is-ok mt-3">
                    ✓ Officer confirmed on {date(satellite.confirmedAt)}
                  </div>
                )}
                {!satellite.confirmedAt && satellite.sourceKind === 'fallback' && (
                  <div className="alert alert-warning mt-3">
                    District climatology fallback — values not officer-confirmed.
                  </div>
                )}
                {!satellite.confirmedAt && satellite.sourceKind === 'live' && (
                  <div className="alert alert-info mt-3">
                    Auto-filled from NASA POWER — awaiting officer confirmation.
                  </div>
                )}
              </div>
            )}

            {/* Farmer + Application summary */}
            <div className="card anim-fade-up anim-d4">
              <div className="card-header">
                <h3 style={{ margin: 0 }}>Case summary</h3>
              </div>

              {/* Farmer avatar strip */}
              {farmer.fullName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'var(--color-primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 800, flexShrink: 0,
                  }}>
                    {initials(farmer.fullName)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{farmer.fullName}</div>
                    <div className="text-sm text-muted">
                      {[farmer.district, farmer.province].filter(Boolean).join(', ') || 'Location not recorded'}
                    </div>
                  </div>
                </div>
              )}

              <div className="kv-grid">
                <SummaryKV label="Gender"        value={farmer.gender} />
                <SummaryKV label="Age"           value={farmer.age} />
                <SummaryKV label="Education"     value={farmer.education} />
                <SummaryKV label="Farm size"     value={farmer.farmSizeHa != null ? `${farmer.farmSizeHa} ha` : null} />
                <SummaryKV label="Household"     value={farmer.householdSize != null ? `${farmer.householdSize} people` : null} />
                <SummaryKV label="Ward"          value={farmer.ward} />
              </div>

              <div className="result-section-label mt-4">Loan request</div>
              <div className="kv-grid">
                <SummaryKV label="Amount"   value={currency(application.amountRequested)} />
                <SummaryKV label="Purpose"  value={application.purpose} />
                <SummaryKV label="Season"   value={application.season} />
                <SummaryKV label="Status"   value={application.status} />
              </div>

              <div className="result-section-label mt-4">Score audit</div>
              <div className="kv-grid">
                <SummaryKV label="Score ID"      value={score.id?.slice(0, 12) + '…'} />
                <SummaryKV label="Scored at"     value={datetime(score.createdAt)} />
                <SummaryKV label="Model version" value={score.modelVersion || '—'} />
                <SummaryKV label="Risk band"     value={score.riskBand} />
              </div>
            </div>
          </div>
        </div>

        {/* Full recommendation text */}
        {score.recommendation && (
          <div className="card anim-fade-up">
            <div className="result-section-label">Full recommendation text (model policy output)</div>
            <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text)' }}>{score.recommendation}</p>
          </div>
        )}

        {/* Next actions footer */}
        <div className="card anim-fade-up" style={{ background: 'var(--color-surface-alt)' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Record Decision</h3>
              <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
                Review the score and explanation, then record your decision below.
              </p>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ borderColor: 'var(--color-risk-high)', color: 'var(--color-risk-high)' }}
                disabled={decisionBusy}
                onClick={() => handleDecision('REJECTED')}
              >
                {decisionBusy && decisionLogged === 'REJECTED' ? 'REJECTING…' : 'REJECT'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ borderColor: 'var(--color-risk-medium)', color: 'var(--color-risk-medium)' }}
                disabled={decisionBusy}
                onClick={() => handleDecision('REVIEW_REQUIRED')}
              >
                {decisionBusy && decisionLogged === 'REVIEW_REQUIRED' ? 'FLAGGING…' : 'FLAG FOR REVIEW'}
              </button>
              <button 
                type="button" 
                className="btn" 
                style={{ background: 'var(--color-risk-low)', borderColor: 'var(--color-risk-low)' }}
                disabled={decisionBusy}
                onClick={() => handleDecision('APPROVED')}
              >
                {decisionBusy && decisionLogged === 'APPROVED' ? 'APPROVING…' : 'APPROVE'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: rebuild prediction object from flat score row ─────────────────────
// The GET /api/scores/:id response may return a flat score row rather than the
// nested prediction object from the scoring wizard. This normalises it.
function buildPredictionFromScore(score) {
  return {
    fin_agri_score:        score.finAgriScore,
    risk_band:             score.riskBand,
    predicted_label:       score.predictedLabel || score.riskBand,
    repayment_probability: score.repaymentProbability,
    p_low_risk:            score.pLowRisk ?? score.repaymentProbability,
    recommendation:        score.recommendation,
    class_probabilities:   score.classProbabilities || null,
    top_factors:           score.topFactors || [],
  };
}

// ── Small display components ──────────────────────────────────────────────────

function EnvKV({ label, value }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v">{value == null || value === '' ? '—' : String(value)}</span>
    </div>
  );
}

function SummaryKV({ label, value }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v">{value == null || value === '' || value === '—' ? '—' : String(value)}</span>
    </div>
  );
}

function SourceBadge({ sat }) {
  if (!sat) return null;
  if (sat.sourceKind === 'live')     return <span className="badge badge-info">Live · NASA POWER</span>;
  if (sat.sourceKind === 'fallback') return <span className="badge badge-medium">District fallback</span>;
  if (sat.sourceKind === 'edited')   return <span className="badge badge-neutral">Officer edited</span>;
  if (sat.confirmedAt)               return <span className="badge badge-low">Confirmed</span>;
  return <span className="badge badge-neutral">On file</span>;
}

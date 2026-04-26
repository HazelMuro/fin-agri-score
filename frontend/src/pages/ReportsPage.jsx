import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  downloadPdf,
  downloadReport,
  PORTFOLIO_SUMMARY_PDF,
  portfolioSummaryPdfFilename,
  REPORT_DOWNLOADS,
} from '../services/reports';

function PortfolioPdfRow({ busy, onDownload }) {
  return (
    <div
      className="flex-between export-row"
      style={{
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ minWidth: 200, flex: '1 1 220px' }}>
        <div style={{ fontWeight: 650, color: 'var(--color-navy)' }}>Portfolio summary (PDF)</div>
        <div className="text-sm text-muted" style={{ marginTop: 4 }}>
          One-page executive snapshot: totals, risk mix, attention metrics, 6-month flow, and latest applications — same
          figures as the dashboard overview.
        </div>
        <div className="text-xs text-faint" style={{ marginTop: 4 }}>
          GET /api/reports/portfolio-summary.pdf
        </div>
      </div>
      <button type="button" className="btn" disabled={!!busy} onClick={onDownload}>
        {busy ? 'Preparing…' : 'Download PDF'}
      </button>
    </div>
  );
}

function ExportRow({ title, description, spec, busy, onDownload }) {
  return (
    <div
      className="flex-between export-row"
      style={{
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ minWidth: 200, flex: '1 1 220px' }}>
        <div style={{ fontWeight: 650, color: 'var(--color-navy)' }}>{title}</div>
        <div className="text-sm text-muted" style={{ marginTop: 4 }}>
          {description}
        </div>
        <div className="text-xs text-faint" style={{ marginTop: 4 }}>
          {spec}
        </div>
      </div>
      <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={onDownload}>
        {busy ? 'Preparing…' : 'Download CSV'}
      </button>
    </div>
  );
}

export default function ReportsPage() {
  const [busyKey, setBusyKey] = useState(null);
  const [err, setErr] = useState(null);

  const run = async (key, path, filename) => {
    setErr(null);
    setBusyKey(key);
    try {
      await downloadReport(path, filename);
    } catch (e) {
      setErr(e.friendlyMessage || 'Download failed. Is the API running?');
    } finally {
      setBusyKey(null);
    }
  };

  const runPdf = async (key, path, filename) => {
    setErr(null);
    setBusyKey(key);
    try {
      await downloadPdf(path, filename);
    } catch (e) {
      setErr(e.friendlyMessage || 'Download failed. Is the API running?');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & downloads</h1>
          <p className="page-subtitle">
            CSV exports for audits and operations (UTF-8 BOM for Excel), plus a portfolio PDF aligned with the
            dashboard overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/history" className="btn btn-secondary">
            Score history
          </Link>
          <Link to="/applications" className="btn btn-secondary">
            Applications
          </Link>
        </div>
      </div>

      {err && (
        <div className="alert alert-danger mb-4" role="alert">
          {err}
        </div>
      )}

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Portfolio exports</h2>
            <span className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <span className="badge badge-info">CSV</span>
              <span className="badge badge-neutral">PDF</span>
            </span>
          </div>
          <PortfolioPdfRow
            busy={busyKey === 'portfolio-pdf'}
            onDownload={() =>
              runPdf('portfolio-pdf', PORTFOLIO_SUMMARY_PDF.path, portfolioSummaryPdfFilename())
            }
          />
          <ExportRow
            title="Loan applications"
            description="All applications with farmer location and latest score snapshot."
            spec="GET /api/reports/applications.csv"
            busy={busyKey === 'applications'}
            onDownload={() =>
              run('applications', REPORT_DOWNLOADS.applications.path, REPORT_DOWNLOADS.applications.filename)
            }
          />
          <ExportRow
            title="Score history"
            description="Every saved Fin-Agri score with farmer, purpose, and recommendation text."
            spec="GET /api/reports/score-history.csv"
            busy={busyKey === 'scores'}
            onDownload={() =>
              run('scores', REPORT_DOWNLOADS.scoreHistory.path, REPORT_DOWNLOADS.scoreHistory.filename)
            }
          />
          <ExportRow
            title="Farmers registry"
            description="Registered farmers with profile signals and application counts."
            spec="GET /api/reports/farmers.csv"
            busy={busyKey === 'farmers'}
            onDownload={() => run('farmers', REPORT_DOWNLOADS.farmers.path, REPORT_DOWNLOADS.farmers.filename)}
          />
          <ExportRow
            title="Monthly summary"
            description="Last 12 calendar months — applications created, scores run, and risk band counts."
            spec="GET /api/reports/monthly-summary.csv"
            busy={busyKey === 'monthly'}
            onDownload={() => run('monthly', REPORT_DOWNLOADS.monthly.path, REPORT_DOWNLOADS.monthly.filename)}
          />
        </div>

        <div className="card">
          <div className="card-header">
            <h2 style={{ margin: 0 }}>Compliance & audit</h2>
            <span className="badge badge-neutral">CSV</span>
          </div>
          <ExportRow
            title="Audit log"
            description="Recent system actions with JSON details (newest first, capped for size)."
            spec="GET /api/reports/audit-log.csv"
            busy={busyKey === 'audit'}
            onDownload={() => run('audit', REPORT_DOWNLOADS.auditLog.path, REPORT_DOWNLOADS.auditLog.filename)}
          />
          <div className="alert alert-info mt-4" style={{ marginBottom: 0 }}>
            <strong>Case PDFs</strong> (application or farmer) are generated from the same stored rows as the CSV
            summaries; use the buttons on each profile or application detail page.
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Case-level exports (CSV & PDF)</h3>
        <p className="text-sm text-muted">
          From <strong>Application detail</strong>, <strong>Farmer profile</strong>, or the <strong>score result</strong>
          step, use <strong>Export case CSV</strong> / <strong>Export case PDF</strong> (or profile variants) for
          committee-ready packs. PDFs are generated server-side (A4, Helvetica) and include readiness plus latest score
          where available.
        </p>
        <ul className="text-xs text-faint stack-sm" style={{ marginBottom: 0, paddingLeft: 18 }}>
          <li><code>GET /api/reports/portfolio-summary.pdf</code></li>
          <li><code>GET /api/reports/applications/:id/summary.pdf</code></li>
          <li><code>GET /api/reports/farmers/:id/summary.pdf</code></li>
        </ul>
      </div>
    </div>
  );
}

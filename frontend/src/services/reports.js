import api from './api';

/**
 * Download a CSV from GET /api/reports/... (blob) — works with Vite proxy and custom API base URL.
 */
export async function downloadPdf(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadReport(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const REPORT_DOWNLOADS = {
  applications: { path: '/reports/applications.csv', filename: 'finagri-applications.csv' },
  scoreHistory: { path: '/reports/score-history.csv', filename: 'finagri-score-history.csv' },
  farmers: { path: '/reports/farmers.csv', filename: 'finagri-farmers.csv' },
  monthly: { path: '/reports/monthly-summary.csv', filename: 'finagri-monthly-summary.csv' },
  auditLog: { path: '/reports/audit-log.csv', filename: 'finagri-audit-log.csv' },
};

/** Dated client filename; server also sets Content-Disposition with the same pattern. */
export function portfolioSummaryPdfFilename() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `finagri-portfolio-${y}-${m}-${day}.pdf`;
}

export const PORTFOLIO_SUMMARY_PDF = { path: '/reports/portfolio-summary.pdf' };

export function applicationSummaryPath(id) {
  return `/reports/applications/${encodeURIComponent(id)}/summary.csv`;
}

export function farmerSummaryPath(id) {
  return `/reports/farmers/${encodeURIComponent(id)}/summary.csv`;
}

export function applicationSummaryPdfPath(id) {
  return `/reports/applications/${encodeURIComponent(id)}/summary.pdf`;
}

export function farmerSummaryPdfPath(id) {
  return `/reports/farmers/${encodeURIComponent(id)}/summary.pdf`;
}

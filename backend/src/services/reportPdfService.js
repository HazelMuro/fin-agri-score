/**
 * pdfkit helpers: portfolio PDF and per-application / per-farmer summary downloads (reportsController).
 */

const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 48;

function textWidth(doc) {
  return doc.page.width - 2 * PAGE_MARGIN;
}

function heading(doc, title) {
  const w = textWidth(doc);
  doc.moveDown(0.6);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(title, PAGE_MARGIN, doc.y, {
    width: w,
  });
  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  doc.moveDown(0.35);
}

function paragraph(doc, text, opts = {}) {
  if (text == null || text === '') return;
  const t = String(text);
  const w = textWidth(doc);
  doc.fontSize(10).font('Helvetica').fillColor('#334155').text(t, {
    width: w,
    align: 'left',
    ...opts,
  });
}

function line(doc, label, value) {
  const w = textWidth(doc);
  const v = value == null || value === '' ? '—' : String(value);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b').text(`${label}: `, {
    continued: true,
    width: w,
  });
  doc.font('Helvetica').fillColor('#0f172a').text(v, { width: w });
  doc.moveDown(0.15);
}

function formatTopFactors(topFactors) {
  if (!topFactors) return '';
  let arr = topFactors;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return arr;
    }
  }
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr
    .slice(0, 8)
    .map((f) => {
      if (typeof f === 'string') return `• ${f}`;
      const name = f.feature || f.label || 'factor';
      const val = f.value != null ? String(f.value) : '';
      const imp = f.impact != null ? ` (impact ${Number(f.impact).toFixed(3)})` : '';
      return `• ${name}${val ? `: ${val}` : ''}${imp}`;
    })
    .join('\n');
}

function pipePdf(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({
    margin: PAGE_MARGIN,
    size: 'A4',
    info: { Producer: 'Fin-Agri Score', Title: filename.replace('.pdf', '') },
  });
  doc.pipe(res);
  return doc;
}

function renderApplicationPdf(doc, { app, readiness }) {
  const w = textWidth(doc);
  const farmer = app.farmer;
  const score = app.creditScores?.[0];
  const sat = app.satelliteData?.[0];

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f').text('Fin-Agri Score — Application summary', PAGE_MARGIN, PAGE_MARGIN, {
    width: w,
  });
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generated ${new Date().toISOString()}`, {
    width: w,
  });
  doc.moveDown(1);

  heading(doc, 'Loan request');
  line(doc, 'Application ID', app.id);
  line(doc, 'Status', app.status);
  line(doc, 'Purpose', app.purpose);
  line(doc, 'Amount requested (USD)', app.amountRequested);
  line(doc, 'Season', app.season);
  line(doc, 'Submitted', app.createdAt?.toISOString?.());

  heading(doc, 'Farmer');
  line(doc, 'Name', farmer?.fullName);
  line(doc, 'District', farmer?.district);
  line(doc, 'Province', farmer?.province);
  line(doc, 'Phone', farmer?.phone);
  line(doc, 'Farm size (ha)', farmer?.farmSizeHa);

  if (readiness) {
    heading(doc, 'Assessment readiness');
    line(doc, 'State', String(readiness.state || '').replace(/_/g, ' '));
    line(doc, 'Completeness', `${readiness.completeness ?? '—'}%`);
    line(doc, 'Confidence', `${readiness.confidence ?? '—'}%`);
    line(doc, 'Can score', readiness.canScore ? 'Yes' : 'No');
    if (readiness.warnings?.length) {
      paragraph(doc, `Warnings:\n${readiness.warnings.map((w) => `• ${w}`).join('\n')}`);
    }
  }

  if (score) {
    heading(doc, 'Latest score');
    line(doc, 'Fin-Agri Score', score.finAgriScore);
    line(doc, 'Risk band', score.riskBand);
    line(doc, 'Predicted label', score.predictedLabel);
    line(
      doc,
      'P (LOW risk class)',
      score.repaymentProbability != null ? `${Math.round(score.repaymentProbability * 100)}%` : '—'
    );
    line(doc, 'Model version', score.modelVersion);
    line(doc, 'Scored at', score.createdAt?.toISOString?.());
    paragraph(doc, score.recommendation || '', { continued: false });
    doc.moveDown(0.3);
    const factors = formatTopFactors(score.topFactors);
    if (factors) {
      heading(doc, 'Top contributing factors');
      paragraph(doc, factors);
    }
  } else {
    heading(doc, 'Latest score');
    paragraph(doc, 'No score has been saved for this application yet.');
  }

  if (sat) {
    heading(doc, 'Environmental context (latest)');
    line(doc, 'Rainfall 30d (mm)', sat.rainfall30dMm);
    line(doc, 'Rainfall 90d (mm)', sat.rainfall90dMm);
    line(doc, 'NDVI mean', sat.ndvi90dMean);
    line(doc, 'NDVI std', sat.ndvi90dStd);
    line(doc, 'Environment risk', sat.environmentRisk);
    line(doc, 'Confirmed at', sat.confirmedAt?.toISOString?.() || 'Not confirmed');
  }

  doc.moveDown(1.2);
  doc.fontSize(8).fillColor('#94a3b8').text(
    'Fin-Agri Score is decision-support only. Model outputs depend on input quality and configured thresholds.',
    PAGE_MARGIN,
    doc.y,
    { width: w, align: 'left' }
  );
}

function renderFarmerPdf(doc, { farmer }) {
  const w = textWidth(doc);
  const hi = farmer.householdIncome;
  const fa = farmer.farmActivities?.[0];
  const sc = farmer.socialCapital?.[0];
  const apps = farmer.applications || [];

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f').text('Fin-Agri Score — Farmer profile', PAGE_MARGIN, PAGE_MARGIN, {
    width: w,
  });
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generated ${new Date().toISOString()}`, {
    width: w,
  });
  doc.moveDown(1);

  heading(doc, 'Identity');
  line(doc, 'Farmer ID', farmer.id);
  line(doc, 'Full name', farmer.fullName);
  line(doc, 'Gender', farmer.gender);
  line(doc, 'Age', farmer.age);
  line(doc, 'Education', farmer.education);
  line(doc, 'Household size', farmer.householdSize);
  line(doc, 'Marital status', farmer.maritalStatus);

  heading(doc, 'Location & land');
  line(doc, 'Province', farmer.province);
  line(doc, 'District', farmer.district);
  line(doc, 'Ward', farmer.ward);
  line(doc, 'Farm size (ha)', farmer.farmSizeHa);
  line(doc, 'Phone', farmer.phone);

  heading(doc, 'Household & income');
  if (hi) {
    line(doc, 'Main source', hi.mainSource);
    line(doc, 'Main amount (USD/mo)', hi.mainAmount);
    line(doc, 'Secondary source', hi.secondarySource);
    line(doc, 'Secondary amount', hi.secondaryAmount);
    line(doc, 'Shock experienced', hi.shockExperienced ? 'Yes' : 'No');
    line(doc, 'Coping index', hi.copingIndex);
    line(doc, 'Dietary diversity', hi.dietaryDiversity);
  } else {
    paragraph(doc, 'No household income record on file.');
  }

  heading(doc, 'Farm activity (latest)');
  if (fa) {
    line(doc, 'Crop', fa.cropType);
    line(doc, 'Estimated yield (t/ha)', fa.estimatedYield);
    line(doc, 'Irrigation', fa.irrigation);
    line(doc, 'Input usage', fa.inputUsage);
    line(doc, 'Season', fa.season);
  } else {
    paragraph(doc, 'No farm activity record on file.');
  }

  heading(doc, 'Social capital (latest)');
  if (sc) {
    line(doc, 'Group member', sc.groupMembership ? 'Yes' : 'No');
    line(doc, 'Group name', sc.groupName);
    line(doc, 'Years in group', sc.yearsInGroup);
    line(doc, 'Leadership role', sc.leadershipRole);
    line(doc, 'Guarantor available', sc.guarantorAvailable ? 'Yes' : 'No');
  } else {
    paragraph(doc, 'No social capital record on file.');
  }

  heading(doc, 'Loan applications');
  if (!apps.length) {
    paragraph(doc, 'No applications linked to this farmer.');
  } else {
    apps.slice(0, 15).forEach((a, i) => {
      paragraph(
        doc,
        `${i + 1}. ${a.purpose} — ${a.status} — USD ${a.amountRequested} — ${a.createdAt?.toISOString?.() || ''}\n   ID: ${a.id}`
      );
      doc.moveDown(0.2);
    });
    if (apps.length > 15) {
      paragraph(doc, `… and ${apps.length - 15} more (see CSV export for full list).`);
    }
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#94a3b8').text(
    'This document summarises stored registration data. Scoring uses the full assessment pipeline.',
    PAGE_MARGIN,
    doc.y,
    { width: w }
  );
}

function applicationSummaryPdf(res, data) {
  const filename = `finagri-application-${data.app.id.slice(0, 8)}.pdf`;
  const doc = pipePdf(res, filename);
  renderApplicationPdf(doc, data);
  doc.end();
}

function farmerSummaryPdf(res, data) {
  const filename = `finagri-farmer-${data.farmer.id.slice(0, 8)}.pdf`;
  const doc = pipePdf(res, filename);
  renderFarmerPdf(doc, data);
  doc.end();
}

function portfolioFilenameDate() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `finagri-portfolio-${y}-${m}-${day}.pdf`;
}

function renderPortfolioPdf(doc, data) {
  const w = textWidth(doc);
  const { totals, riskDistribution, attention, monthlyTrend, recentApplications } = data;
  const avgDisplay = Number.isFinite(totals.avgFinAgriScore) ? String(totals.avgFinAgriScore) : '—';

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f').text('Fin-Agri Score — Portfolio summary', PAGE_MARGIN, PAGE_MARGIN, {
    width: w,
  });
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Generated ${new Date().toISOString()}`, {
    width: w,
  });
  doc.moveDown(0.8);
  paragraph(
    doc,
    'Executive snapshot of registered farmers, loan applications, and scoring outcomes. Figures match the dashboard overview API.'
  );
  doc.moveDown(0.6);

  heading(doc, 'Totals');
  line(doc, 'Registered farmers', totals.farmers);
  line(doc, 'Loan applications', totals.applications);
  line(doc, 'Saved score runs', totals.scoredApplications);
  line(doc, 'Average Fin-Agri score (all runs)', avgDisplay);

  heading(doc, 'Risk distribution (saved scores)');
  line(doc, 'Low risk', riskDistribution.Low);
  line(doc, 'Medium risk', riskDistribution.Medium);
  line(doc, 'High risk', riskDistribution.High);

  heading(doc, 'Operational attention');
  line(doc, 'Pending applications', attention.pendingApplications);
  line(doc, 'Applications with no score yet', attention.unscoredApplications);
  line(doc, 'High-risk scores (last 30 days)', attention.highRiskRecent);
  line(doc, 'Applications submitted (last 30 days)', attention.recentlySubmittedApplications);

  heading(doc, 'Monthly flow (last 6 months)');
  if (monthlyTrend?.length) {
    monthlyTrend.forEach((row) => {
      paragraph(doc, `• ${row.month}: ${row.applications} new applications, ${row.scored} scores recorded`);
    });
  } else {
    paragraph(doc, 'No trend rows.');
  }

  heading(doc, 'Recent applications (latest 8)');
  if (!recentApplications?.length) {
    paragraph(doc, 'No applications on file.');
  } else {
    recentApplications.forEach((a, i) => {
      const score = a.finAgriScore != null ? String(a.finAgriScore) : '—';
      const band = a.riskBand || '—';
      paragraph(
        doc,
        `${i + 1}. ${a.farmerName} (${a.district}) — ${a.purpose} — ${a.status} — score ${score} / ${band} — USD ${a.amountRequested}`
      );
      doc.moveDown(0.15);
    });
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#94a3b8').text(
    'Portfolio counts include all stored records. Risk bands are per saved score row. For detail, use case-level PDFs or CSV exports.',
    PAGE_MARGIN,
    doc.y,
    { width: w }
  );
}

function portfolioSummaryPdf(res, data) {
  const filename = portfolioFilenameDate();
  const doc = pipePdf(res, filename);
  renderPortfolioPdf(doc, data);
  doc.end();
}

module.exports = {
  applicationSummaryPdf,
  farmerSummaryPdf,
  portfolioSummaryPdf,
};

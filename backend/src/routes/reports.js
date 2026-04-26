const { Router } = require('express');
const c = require('../controllers/reportsController');

const router = Router();

router.get('/applications.csv', c.applicationsCsv);
router.get('/score-history.csv', c.scoreHistoryCsv);
router.get('/farmers.csv', c.farmersCsv);
router.get('/monthly-summary.csv', c.monthlySummaryCsv);
router.get('/portfolio-summary.pdf', c.portfolioSummaryPdf);
router.get('/audit-log.csv', c.auditLogsCsv);
router.get('/applications/:id/summary.csv', c.applicationSummaryCsv);
router.get('/applications/:id/summary.pdf', c.applicationSummaryPdf);
router.get('/farmers/:id/summary.csv', c.farmerSummaryCsv);
router.get('/farmers/:id/summary.pdf', c.farmerSummaryPdf);

module.exports = router;

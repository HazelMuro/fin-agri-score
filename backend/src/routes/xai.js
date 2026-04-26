const { Router } = require('express');
const c = require('../controllers/xaiController');

const router = Router();

router.get('/overview', c.getOverview);
router.get('/feature-importance', c.getFeatureImportance);
router.get('/sample-explanations', c.getSampleExplanations);
router.get('/evaluation-summary', c.getEvaluationSummary);

module.exports = router;


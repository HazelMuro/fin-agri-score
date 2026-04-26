const { Router } = require('express');
const c = require('../controllers/assessmentsController');

const router = Router();

router.post('/assessments/score', c.scoreAssessment);

module.exports = router;


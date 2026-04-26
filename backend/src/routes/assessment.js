const { Router } = require('express');
const readinessController = require('../controllers/readinessController');
const environmentController = require('../controllers/environmentController');
const districtsController = require('../controllers/districtsController');

const router = Router();

router.get('/districts', districtsController.list);
router.get('/applications/:applicationId/readiness', readinessController.getReadiness);
router.get(
  '/applications/:applicationId/assessment-summary',
  readinessController.getAssessmentSummary
);
router.post('/applications/:applicationId/environment/autofill', environmentController.autofill);
router.post('/applications/:applicationId/environment/confirm', environmentController.confirm);
router.patch('/applications/:applicationId/environment', environmentController.edit);

module.exports = router;

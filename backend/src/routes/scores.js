/**
 * Mounted under /api: POST …/applications/:id/score and GET …/scores (list & detail).
 */

const { Router } = require('express');
const c = require('../controllers/scoresController');

const router = Router();

router.post('/applications/:applicationId/score', c.scoreApp);
router.get('/scores', c.list);
router.get('/scores/:id', c.getOne);

module.exports = router;

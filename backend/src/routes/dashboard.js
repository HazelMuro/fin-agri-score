const { Router } = require('express');
const c = require('../controllers/dashboardController');

const router = Router();

router.get('/overview', c.overview);
router.get('/score-history', c.scoreHistory);

module.exports = router;

const { Router } = require('express');
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

const router = Router();

router.post('/login', c.login);
router.get('/me', requireAuth, c.me);

module.exports = router;

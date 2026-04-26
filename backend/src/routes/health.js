const { Router } = require('express');
const inferenceClient = require('../services/inferenceClient');

const router = Router();

router.get('/', async (req, res) => {
  const inference = await inferenceClient.health();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    inferenceService: inference,
  });
});

module.exports = router;

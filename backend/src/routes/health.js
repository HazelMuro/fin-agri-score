/**
 * GET /api/health — combined Postgres ping + inference microservice GET /health for ops dashboards.
 */

const { Router } = require('express');
const prisma = require('../config/prisma');
const inferenceClient = require('../services/inferenceClient');

const router = Router();

router.get('/', async (req, res) => {
  let database = { ok: false, error: 'not checked' };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true };
  } catch (e) {
    database = { ok: false, error: e.message || 'database unreachable' };
  }

  const inference = await inferenceClient.health();

  const allOk = database.ok;
  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database,
    inferenceService: inference,
  });
});

module.exports = router;

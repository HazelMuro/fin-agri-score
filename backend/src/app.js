/**
 * Express application factory (no listen): middleware + route mounting + global error handlers.
 *
 * Route layout:
 *   /api/health, /api/auth/*           — no business CRUD behind JWT when secret unset (see requireAuth)
 *   /api/farmers, /applications, …    — loan-officer APIs (JWT or open demo per requireAuth)
 *
 * Mounted from server.js; tests may require('./app') without starting a port.
 */

require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const farmersRoutes = require('./routes/farmers');
const applicationsRoutes = require('./routes/applications');
const scoresRoutes = require('./routes/scores');
const dashboardRoutes = require('./routes/dashboard');
const supportingRoutes = require('./routes/supporting');
const healthRoutes = require('./routes/health');
const assessmentRoutes = require('./routes/assessment');
const assessmentsRoutes = require('./routes/assessments');
const xaiRoutes = require('./routes/xai');
const reportsRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/requireAuth');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin.split(',').map((s) => s.trim()),
    credentials: false,
  })
);
app.use(express.json({ limit: '2mb' }));
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/farmers', requireAuth, farmersRoutes);
app.use('/api/applications', requireAuth, applicationsRoutes);
app.use('/api', requireAuth, scoresRoutes);
app.use('/api', requireAuth, assessmentRoutes);
app.use('/api', requireAuth, assessmentsRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/xai', requireAuth, xaiRoutes);
app.use('/api/reports', requireAuth, reportsRoutes);
app.use('/api', requireAuth, supportingRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Fin-Agri Score — Backend API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: [
      'GET  /api/dashboard/overview',
      'GET  /api/farmers',
      'POST /api/farmers',
      'GET  /api/applications',
      'POST /api/applications',
      'POST /api/applications/:id/score',
      'POST /api/assessments/score',
      'GET  /api/scores',
      'GET  /api/xai/overview',
      'GET  /api/audit-logs',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/reports/applications.csv',
      'GET  /api/reports/score-history.csv',
      'GET  /api/reports/farmers.csv',
      'GET  /api/reports/monthly-summary.csv',
      'GET  /api/reports/audit-log.csv',
      'GET  /api/reports/portfolio-summary.pdf',
      'GET  /api/reports/applications/:id/summary.pdf',
      'GET  /api/reports/farmers/:id/summary.pdf',
    ],
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

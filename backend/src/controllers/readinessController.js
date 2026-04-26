const prisma = require('../config/prisma');
const readinessService = require('../services/readinessService');

async function getReadiness(req, res) {
  const data = await readinessService.evaluate(req.params.applicationId);
  res.json(data);
}

/**
 * One payload for the operator UI: nested application, related records,
 * last scores, recent audit, plus readiness evaluation.
 */
async function getAssessmentSummary(req, res) {
  const { applicationId } = req.params;
  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      farmer: {
        include: {
          householdIncome: true,
          farmActivities: { orderBy: { createdAt: 'desc' } },
          assets: { take: 8, orderBy: { createdAt: 'desc' } },
          socialCapital: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      satelliteData: { orderBy: { createdAt: 'desc' } },
      creditScores: { orderBy: { createdAt: 'desc' }, take: 5 },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 15 },
    },
  });
  if (!app) {
    return res.status(404).json({ error: { message: 'Application not found' } });
  }
  const readiness = await readinessService.evaluate(applicationId);
  res.json({ readiness, application: app });
}

module.exports = { getReadiness, getAssessmentSummary };

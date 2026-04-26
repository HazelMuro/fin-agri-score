const { z } = require('zod');
const prisma = require('../config/prisma');
const scoringService = require('../services/scoringService');

const scoreRequestSchema = z.object({
  application_id: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  force: z.boolean().optional(),
  rescore: z.boolean().optional(),
  acting_user_id: z.string().optional(),
  actingUserId: z.string().optional(),
});

async function scoreAssessment(req, res) {
  const payload = scoreRequestSchema.parse(req.body || {});
  const applicationId = payload.application_id || payload.applicationId;
  if (!applicationId) {
    return res.status(400).json({
      error: {
        message: 'application_id is required',
        code: 'VALIDATION_ERROR',
      },
    });
  }

  const actingUserId = payload.acting_user_id || payload.actingUserId || null;
  const force = payload.force === true;
  const rescore = payload.rescore === true;

  try {
    const result = await scoringService.scoreApplication(applicationId, {
      actingUserId,
      force,
      rescore,
    });
    const app = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
      include: { farmer: { select: { id: true, fullName: true } } },
    });

    const status = result.reused ? 200 : 201;
    return res.status(status).json({
      farmer_id: app?.farmer?.id || null,
      farmer_name: app?.farmer?.fullName || null,
      application_id: applicationId,
      predicted_label: result.prediction?.predicted_label || null,
      p_low_risk:
        result.prediction?.p_low_risk ?? result.prediction?.repayment_probability ?? null,
      fin_agri_score: result.prediction?.fin_agri_score ?? null,
      risk_band: result.prediction?.risk_band || null,
      recommendation: result.prediction?.recommendation || null,
      class_probabilities: result.prediction?.class_probabilities || null,
      model_name: result.prediction?.model_name || null,
      model_version: result.prediction?.model_version || null,
      readiness_state: result.readiness?.state || null,
      saved_score_id: result.score?.id || null,
      scored_at: result.score?.createdAt || null,
      reused: !!result.reused,
      reused_age_sec: result.reusedAgeSec || null,
    });
  } catch (err) {
    if (err.code === 'READINESS_GATE') {
      return res.status(422).json({
        error: {
          message: err.message,
          code: 'READINESS_GATE',
          readiness: err.details,
        },
      });
    }
    throw err;
  }
}

module.exports = { scoreAssessment };


/**
 * Scoring orchestrator — the centrepiece of Objective 2.
 *
 * Flow:
 *   1. Run readiness check — refuses to score unless state allows it.
 *   2. Dedupe: if a score was produced within SCORE_DEDUPE_SECONDS, return it.
 *      A real re-score requires `{ rescore: true }` in the payload.
 *   3. Load application + farmer + household + latest activity/social/satellite.
 *   4. Build the (honest) feature dictionary + per-field provenance.
 *   5. Call the Python inference microservice.
 *   6. Derive a combined data-confidence number from provenance + imputed features.
 *   7. Persist a credit_score row.
 *   8. Write an audit_logs entry.
 *   9. Return a frontend-friendly payload including inputs, provenance, and warnings.
 */

const prisma = require('../config/prisma');
const inferenceClient = require('./inferenceClient');
const { buildFeaturesFromRecord } = require('./featureBuilder');
const auditService = require('./auditService');
const readinessService = require('./readinessService');

const DEDUPE_SECONDS = Number(process.env.SCORE_DEDUPE_SECONDS || 60);

function summariseProvenance(provenance) {
  const counts = {};
  Object.values(provenance).forEach((k) => {
    counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

function computeDataConfidence({ readiness, featureCoverage, provenance }) {
  const readinessTerm = readiness.confidence / 100;

  const total = Object.keys(provenance).length || 1;
  const { CONFIDENCE_WEIGHTS } = readinessService;
  const provTerm =
    Object.values(provenance).reduce(
      (a, k) => a + (CONFIDENCE_WEIGHTS[k] ?? 0),
      0
    ) / total;

  const coverageTerm = Math.max(0.0, Math.min(1.0, Number(featureCoverage) || 0));

  const combined = readinessTerm * 0.5 + provTerm * 0.3 + coverageTerm * 0.2;
  return Math.round(combined * 100);
}

async function scoreApplication(
  applicationId,
  { actingUserId = null, force = false, rescore = false } = {}
) {
  const readiness = await readinessService.evaluate(applicationId);

  if (!readiness.canScore && !force) {
    const err = new Error(
      'Application is not ready for scoring. Complete and confirm the flagged sections first.'
    );
    err.statusCode = 422;
    err.code = 'READINESS_GATE';
    err.details = readiness;
    throw err;
  }

  if (!rescore) {
    const recent = await prisma.creditScore.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: { application: { include: { farmer: true } } },
    });
    if (recent) {
      const ageSec = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
      if (ageSec < DEDUPE_SECONDS) {
        return {
          score: recent,
          application: recent.application,
          prediction: {
            predicted_label: recent.predictedLabel,
            class_probabilities: recent.classProbabilities,
            p_low_risk: recent.repaymentProbability,
            fin_agri_score: recent.finAgriScore,
            risk_band: recent.riskBand,
            recommendation: recent.recommendation,
            top_factors: recent.topFactors || [],
            model_name: recent.modelName,
            model_version: recent.modelVersion,
          },
          readiness,
          reused: true,
          reusedAgeSec: Math.round(ageSec),
        };
      }
    }
  }

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      farmer: {
        include: {
          householdIncome: true,
          farmActivities: { orderBy: { createdAt: 'desc' }, take: 1 },
          socialCapital: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      satelliteData: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!application) {
    const err = new Error(`Application not found: ${applicationId}`);
    err.statusCode = 404;
    throw err;
  }

  const activity = application.farmer.farmActivities[0] || null;
  const social = application.farmer.socialCapital[0] || null;
  const satellite = application.satelliteData[0] || null;
  const household = application.farmer.householdIncome || null;

  const { features, provenance } = buildFeaturesFromRecord({
    farmer: application.farmer,
    application,
    activity,
    social,
    satellite,
    household,
  });

  const prediction = await inferenceClient.predict(features, applicationId);

  const dataConfidence = computeDataConfidence({
    readiness,
    featureCoverage: prediction.feature_coverage,
    provenance,
  });

  const provenanceSummary = summariseProvenance(provenance);

  const pLow =
    prediction.p_low_risk != null
      ? prediction.p_low_risk
      : prediction.repayment_probability;

  const score = await prisma.creditScore.create({
    data: {
      applicationId,
      predictedLabel: prediction.predicted_label,
      classProbabilities: prediction.class_probabilities,
      repaymentProbability: pLow,
      finAgriScore: prediction.fin_agri_score,
      riskBand: prediction.risk_band,
      recommendation: prediction.recommendation,
      topFactors: prediction.top_factors || [],
      modelName: prediction.model_name,
      modelVersion: prediction.model_version,
    },
  });

  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: { status: 'SCORED' },
  });

  await auditService.log({
    applicationId,
    userId: actingUserId,
    action: rescore ? 'APPLICATION_RESCORED' : 'APPLICATION_SCORED',
    details: {
      finAgriScore: prediction.fin_agri_score,
      riskBand: prediction.risk_band,
      predictedLabel: prediction.predicted_label,
      modelVersion: prediction.model_version,
      forced: !readiness.canScore && force,
      readinessState: readiness.state,
      readinessCompleteness: readiness.completeness,
      readinessConfidence: readiness.confidence,
      dataConfidence,
      featureCoverage: prediction.feature_coverage,
      imputedFeatureCount: (prediction.imputed_features || []).length,
    },
  });

  return {
    score,
    application,
    prediction,
    readiness,
    featuresUsed: features,
    featureProvenance: provenance,
    provenanceSummary,
    dataConfidence,
    imputedFeatures: prediction.imputed_features || [],
    featureCoverage: prediction.feature_coverage,
    household,
    activity,
    social,
    satellite,
    reused: false,
  };
}

module.exports = { scoreApplication };

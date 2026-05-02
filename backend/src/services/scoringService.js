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
const {
  buildFeaturesFromRecord,
  projectModelInputSnapshot,
  modelInputsEquivalent,
  computeMappableCoverageStats,
  applyTrainingMediumOverlay,
} = require('./featureBuilder');
const auditService = require('./auditService');
const readinessService = require('./readinessService');
const { getRescoreMinorBlendDecision } = require('./rescoreMinorBlend');

const DEDUPE_SECONDS = Number(process.env.SCORE_DEDUPE_SECONDS || 60);

function predictionPayloadFromStoredScore(row) {
  const meta = row.featuresSnapshot?.meta || {};
  return {
    predicted_label: row.predictedLabel,
    class_probabilities: row.classProbabilities,
    p_low_risk: row.repaymentProbability,
    fin_agri_score: row.finAgriScore,
    risk_band: row.riskBand,
    recommendation: row.recommendation,
    top_factors: row.topFactors || [],
    model_name: row.modelName,
    model_version: row.modelVersion,
    feature_coverage:
      meta.featureCoverage != null ? meta.featureCoverage : undefined,
    imputed_features: [],
    probability_blend_applied: false,
  };
}

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
        const meta = recent.featuresSnapshot?.meta || {};
        return {
          score: recent,
          application: recent.application,
          prediction: predictionPayloadFromStoredScore(recent),
          readiness,
          reused: true,
          reusedAgeSec: Math.round(ageSec),
          reusedReason: 'TIME_DEDUPE',
          mappableCoverage: meta.mappableCoverage ?? null,
          mappableFilled: meta.mappableFilled ?? null,
          mappableTotal: meta.mappableTotal ?? null,
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
          assets: { orderBy: { createdAt: 'desc' }, take: 40 },
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
  const assetRows = application.farmer.assets || [];

  const { features, provenance } = buildFeaturesFromRecord({
    farmer: application.farmer,
    application,
    activity,
    social,
    satellite,
    household,
    assets: assetRows,
  });

  const featuresForModel = applyTrainingMediumOverlay(
    features,
    application.farmer.phone
  );

  const mappableStats = computeMappableCoverageStats(featuresForModel);

  const inputSnapshot = projectModelInputSnapshot(featuresForModel);

  let prevScore = null;
  let prevInputs = null;

  if (rescore) {
    prevScore = await prisma.creditScore.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    const snap = prevScore?.featuresSnapshot;
    prevInputs =
      snap?.modelInputs ??
      (snap && typeof snap === 'object' && !snap.meta ? snap : null);
    if (
      prevInputs &&
      snap &&
      modelInputsEquivalent(prevInputs, inputSnapshot)
    ) {
      const prediction = predictionPayloadFromStoredScore(prevScore);
      const fc = prediction.feature_coverage;
      const dataConfidence = computeDataConfidence({
        readiness,
        featureCoverage: fc != null ? fc : undefined,
        provenance,
      });

      await auditService.log({
        applicationId,
        userId: actingUserId,
        action: 'APPLICATION_RESCORE_SKIPPED',
        details: {
          reason: 'MODEL_INPUT_UNCHANGED',
          predictedLabel: prevScore.predictedLabel,
          riskBand: prevScore.riskBand,
        },
      });

      return {
        score: prevScore,
        application,
        prediction,
        readiness,
        featuresUsed: featuresForModel,
        featureProvenance: provenance,
        provenanceSummary: summariseProvenance(provenance),
        dataConfidence,
        imputedFeatures: [],
        featureCoverage: fc ?? null,
        household,
        activity,
        social,
        satellite,
        reused: true,
        reusedReason: 'MODEL_INPUT_UNCHANGED',
        mappableCoverage: mappableStats.mappableCoverage,
        mappableFilled: mappableStats.mappableFilled,
        mappableTotal: mappableStats.mappableTotal,
      };
    }
  }

  let minorBlendOpts = {};
  let minorBlendMeta = null;
  if (rescore && prevScore && prevInputs) {
    const blendDecision = getRescoreMinorBlendDecision(
      prevInputs,
      inputSnapshot,
      prevScore
    );
    if (blendDecision.apply) {
      minorBlendOpts = {
        previousClassProbabilities: blendDecision.previousClassProbabilities,
        minorBlendAlpha: blendDecision.minorBlendAlpha,
      };
      minorBlendMeta = {
        alpha: blendDecision.minorBlendAlpha,
        changedKeys: blendDecision.changedKeys,
      };
    }
  }

  const prediction = await inferenceClient.predict(
    featuresForModel,
    applicationId,
    minorBlendOpts
  );

  const dataConfidence = computeDataConfidence({
    readiness,
    featureCoverage: prediction.feature_coverage,
    provenance,
  });

  const probs = prediction.class_probabilities || {};
  let pRepayment =
    prediction.p_low_risk != null
      ? prediction.p_low_risk
      : prediction.repayment_probability;

  // Better proxy for "Confidence they will repay": 1 - P(HIGH_RISK)
  if (probs.HIGH != null) {
    pRepayment = 1 - probs.HIGH;
  } else if (probs.LOW != null && probs.MEDIUM != null) {
    pRepayment = probs.LOW + probs.MEDIUM;
  }

  const score = await prisma.creditScore.create({
    data: {
      applicationId,
      predictedLabel: prediction.predicted_label,
      classProbabilities: prediction.class_probabilities,
      repaymentProbability: pRepayment,
      finAgriScore: prediction.fin_agri_score,
      riskBand: prediction.risk_band,
      recommendation: prediction.recommendation,
      topFactors: prediction.top_factors || [],
      modelName: prediction.model_name,
      modelVersion: prediction.model_version,
      featuresSnapshot: {
        modelInputs: inputSnapshot,
        meta: {
          featureCoverage: prediction.feature_coverage,
          imputedFeatureCount: (prediction.imputed_features || []).length,
          mappableCoverage: mappableStats.mappableCoverage,
          mappableFilled: mappableStats.mappableFilled,
          mappableTotal: mappableStats.mappableTotal,
        },
      },
    },
  });

  await prisma.loanApplication.update({
    where: { id: applicationId },
    data: {
      status: 'SCORED',
      updatedAt: new Date(),
    },
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
      probabilityBlendApplied: !!prediction.probability_blend_applied,
      minorBlendAlpha: minorBlendMeta?.alpha,
      minorBlendFields: minorBlendMeta?.changedKeys,
    },
  });

  return {
    score,
    application,
    prediction,
    readiness,
    featuresUsed: featuresForModel,
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
    minorBlendApplied: !!prediction.probability_blend_applied,
    minorBlendFields: minorBlendMeta?.changedKeys || null,
    mappableCoverage: mappableStats.mappableCoverage,
    mappableFilled: mappableStats.mappableFilled,
    mappableTotal: mappableStats.mappableTotal,
  };
}

module.exports = { scoreApplication };

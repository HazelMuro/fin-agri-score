/**
 * Scoring HTTP layer: POST run prediction + persist CreditScore; GET list scores / one score by id.
 */

const prisma = require('../config/prisma');
const scoringService = require('../services/scoringService');

async function scoreApp(req, res) {
  const applicationId = req.params.applicationId;
  const actingUserId = req.body?.actingUserId || null;
  const force = req.query?.force === 'true' || req.body?.force === true;
  const rescore = req.query?.rescore === 'true' || req.body?.rescore === true;

  try {
    const result = await scoringService.scoreApplication(applicationId, {
      actingUserId,
      force,
      rescore,
    });

    const status = result.reused ? 200 : 201;
    res.status(status).json({
      score: result.score,
      prediction: result.prediction,
      readiness: result.readiness,
      reused: result.reused || false,
      reusedAgeSec: result.reusedAgeSec || null,
      reusedReason: result.reusedReason || null,
      minorBlendApplied: result.minorBlendApplied || false,
      minorBlendFields: result.minorBlendFields || null,
      dataConfidence: result.dataConfidence ?? null,
      featureCoverage: result.featureCoverage ?? null,
      mappableCoverage: result.mappableCoverage ?? null,
      mappableFilled: result.mappableFilled ?? null,
      mappableTotal: result.mappableTotal ?? null,
      imputedFeatures: result.imputedFeatures || [],
      provenanceSummary: result.provenanceSummary || null,
      featuresUsed: result.featuresUsed,
      featureProvenance: result.featureProvenance || null,
      inputs: {
        farmer: result.application?.farmer,
        application: {
          id: result.application?.id,
          amountRequested: result.application?.amountRequested,
          purpose: result.application?.purpose,
          season: result.application?.season,
        },
        household: result.household,
        activity: result.activity,
        social: result.social,
        satellite: result.satellite,
      },
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

async function list(req, res) {
  const { riskBand, take = 50, skip = 0 } = req.query;
  const where = {};
  if (riskBand) where.riskBand = riskBand;

  const [items, total] = await Promise.all([
    prisma.creditScore.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(take),
      skip: Number(skip),
      include: {
        application: {
          include: {
            farmer: { select: { id: true, fullName: true, district: true } },
          },
        },
      },
    }),
    prisma.creditScore.count({ where }),
  ]);

  res.json({ items, total });
}

async function getOne(req, res) {
  const score = await prisma.creditScore.findUnique({
    where: { id: req.params.id },
    include: {
      application: {
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
      },
    },
  });
  if (!score) return res.status(404).json({ error: { message: 'Score not found' } });
  res.json(score);
}

module.exports = { scoreApp, list, getOne };

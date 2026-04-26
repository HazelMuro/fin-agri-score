const xaiArtifacts = require('../services/xaiArtifactsService');

function toInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

async function getOverview(req, res) {
  const takeFeatures = toInt(req.query.takeFeatures, 15);
  res.json(xaiArtifacts.getOverview({ takeFeatures }));
}

async function getFeatureImportance(req, res) {
  const take = toInt(req.query.take, 30);
  const offset = toInt(req.query.offset, 0);
  res.json(xaiArtifacts.getFeatureImportance({ take, offset }));
}

async function getSampleExplanations(req, res) {
  const take = toInt(req.query.take, 5);
  const offset = toInt(req.query.offset, 0);
  res.json(xaiArtifacts.getSampleExplanations({ take, offset }));
}

async function getEvaluationSummary(req, res) {
  res.json(xaiArtifacts.getEvaluationSummary());
}

module.exports = {
  getOverview,
  getFeatureImportance,
  getSampleExplanations,
  getEvaluationSummary,
};


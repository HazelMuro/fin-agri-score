const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const env = require('../config/env');

function resolveArtifactsDir() {
  const configured = env.artifactsDir;
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(process.cwd(), configured);
}

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readFeatureImportance(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  return rows
    .map((r) => ({
      feature: r.feature,
      importance: Number(r.importance),
    }))
    .filter((r) => r.feature && Number.isFinite(r.importance))
    .sort((a, b) => b.importance - a.importance);
}

function loadAllArtifacts() {
  const dir = resolveArtifactsDir();
  const file = (name) => path.join(dir, name);

  const topFeatures = readJsonIfExists(file('top_features.json'), { top_features: [] });
  const sampleShap = readJsonIfExists(file('sample_shap_explanations.json'), []);
  const evaluationSummary = readJsonIfExists(file('evaluation_summary.json'), null);
  const modelMetadata = readJsonIfExists(file('model_metadata.json'), null);
  const featureImportance = readFeatureImportance(file('feature_importance.csv'));

  const availability = {
    feature_importance_csv: fs.existsSync(file('feature_importance.csv')),
    top_features_json: fs.existsSync(file('top_features.json')),
    sample_shap_json: fs.existsSync(file('sample_shap_explanations.json')),
    evaluation_summary_json: fs.existsSync(file('evaluation_summary.json')),
    model_metadata_json: fs.existsSync(file('model_metadata.json')),
  };

  return {
    artifactsDir: dir,
    availability,
    topFeatures: Array.isArray(topFeatures?.top_features) ? topFeatures.top_features : [],
    sampleShap: Array.isArray(sampleShap) ? sampleShap : [],
    evaluationSummary,
    modelMetadata,
    featureImportance,
  };
}

function getOverview({ takeFeatures = 15 } = {}) {
  const data = loadAllArtifacts();
  return {
    source: 'objective1_saved_artifacts',
    artifactsDir: data.artifactsDir,
    availability: data.availability,
    selectedModel:
      data.modelMetadata?.selected_model ||
      data.evaluationSummary?.selected_model ||
      null,
    finalMetrics:
      data.modelMetadata?.final_test_metrics ||
      data.evaluationSummary?.final_test_metrics ||
      null,
    topFeatures: data.topFeatures.slice(0, takeFeatures),
    featureImportanceTop: data.featureImportance.slice(0, takeFeatures),
    sampleExplanationCount: data.sampleShap.length,
    classLabels:
      data.modelMetadata?.class_labels ||
      data.evaluationSummary?.class_labels ||
      [],
  };
}

function getFeatureImportance({ take = 30, offset = 0 } = {}) {
  const data = loadAllArtifacts();
  return {
    source: 'feature_importance.csv',
    total: data.featureImportance.length,
    items: data.featureImportance.slice(offset, offset + take),
  };
}

function getSampleExplanations({ take = 5, offset = 0 } = {}) {
  const data = loadAllArtifacts();
  return {
    source: 'sample_shap_explanations.json',
    total: data.sampleShap.length,
    items: data.sampleShap.slice(offset, offset + take),
  };
}

function getEvaluationSummary() {
  const data = loadAllArtifacts();
  return {
    source: 'evaluation_summary.json',
    item: data.evaluationSummary,
  };
}

module.exports = {
  getOverview,
  getFeatureImportance,
  getSampleExplanations,
  getEvaluationSummary,
};


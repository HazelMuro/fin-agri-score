import api from './api';

export const getXaiOverview = (takeFeatures = 12) =>
  api
    .get('/xai/overview', { params: { takeFeatures } })
    .then((r) => r.data);

export const getXaiFeatureImportance = (take = 30, offset = 0) =>
  api
    .get('/xai/feature-importance', { params: { take, offset } })
    .then((r) => r.data);

export const getXaiSampleExplanations = (take = 5, offset = 0) =>
  api
    .get('/xai/sample-explanations', { params: { take, offset } })
    .then((r) => r.data);

export const getXaiEvaluationSummary = () =>
  api.get('/xai/evaluation-summary').then((r) => r.data);


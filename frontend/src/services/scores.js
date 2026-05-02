/**
 * POST /api/applications/:id/score and GET /api/scores (list/detail).
 */

import api from './api';

export const scoreApplication = (
  applicationId,
  { force = false, rescore = false } = {}
) => {
  const params = {};
  if (force) params.force = 'true';
  if (rescore) params.rescore = 'true';
  return api
    .post(`/applications/${applicationId}/score`, { force, rescore }, { params })
    .then((r) => r.data);
};

export const listScores = (params = {}) =>
  api.get('/scores', { params }).then((r) => r.data);

export const getScore = (id) => api.get(`/scores/${id}`).then((r) => r.data);

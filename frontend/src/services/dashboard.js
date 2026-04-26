import api from './api';

export const getOverview = () =>
  api.get('/dashboard/overview').then((r) => r.data);

export const getScoreHistory = (take = 25) =>
  api.get('/dashboard/score-history', { params: { take } }).then((r) => r.data);

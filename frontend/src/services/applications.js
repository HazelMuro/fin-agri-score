/**
 * Thin wrappers for /api/applications (list, detail, create, status patch).
 */

import api from './api';

export const listApplications = (params = {}) =>
  api.get('/applications', { params }).then((r) => r.data);

export const getApplication = (id) =>
  api.get(`/applications/${id}`).then((r) => r.data);

export const createApplication = (payload) =>
  api.post('/applications', payload).then((r) => r.data);

export const updateApplicationStatus = (id, status) =>
  api.patch(`/applications/${id}/status`, { status }).then((r) => r.data);

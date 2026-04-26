import api from './api';

export const getReadiness = (applicationId) =>
  api.get(`/applications/${applicationId}/readiness`).then((r) => r.data);

/** Full application + related records + audit + last scores, with readiness. */
export const getAssessmentSummary = (applicationId) =>
  api
    .get(`/applications/${applicationId}/assessment-summary`)
    .then((r) => r.data);

export const autofillEnvironment = (applicationId, { force = false } = {}) =>
  api
    .post(
      `/applications/${applicationId}/environment/autofill`,
      {},
      { params: force ? { force: 'true' } : {} }
    )
    .then((r) => r.data);

export const confirmEnvironment = (applicationId, { actingUserId } = {}) =>
  api
    .post(`/applications/${applicationId}/environment/confirm`, { actingUserId })
    .then((r) => r.data);

export const editEnvironment = (applicationId, patch) =>
  api.patch(`/applications/${applicationId}/environment`, patch).then((r) => r.data);

export const createFarmActivity = (payload) =>
  api.post('/farm-activities', payload).then((r) => r.data);

export const createSocialCapital = (payload) =>
  api.post('/social-capital', payload).then((r) => r.data);

export const upsertHouseholdIncome = (payload) =>
  api.post('/household-income', payload).then((r) => r.data);

export const createSatelliteData = (payload) =>
  api.post('/satellite-data', payload).then((r) => r.data);

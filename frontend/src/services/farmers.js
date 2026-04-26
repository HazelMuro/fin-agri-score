import api from './api';

export const listFarmers = (params = {}) =>
  api.get('/farmers', { params }).then((r) => r.data);

export const getFarmer = (id) => api.get(`/farmers/${id}`).then((r) => r.data);

export const createFarmer = (payload) =>
  api.post('/farmers', payload).then((r) => r.data);

export const updateFarmer = (id, payload) =>
  api.patch(`/farmers/${id}`, payload).then((r) => r.data);

export const deleteFarmer = (id) => api.delete(`/farmers/${id}`).then((r) => r.data);

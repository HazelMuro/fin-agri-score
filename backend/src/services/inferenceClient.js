/**
 * Thin HTTP client that talks to the Python inference microservice.
 * Isolating it here means the rest of the codebase doesn't care whether the
 * model is local, remote, or replaced later.
 */

const axios = require('axios');
const env = require('../config/env');

const client = axios.create({
  baseURL: env.inferenceServiceUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

async function predict(features, applicationId) {
  try {
    const response = await client.post('/predict', {
      features,
      application_id: applicationId,
    });
    return response.data;
  } catch (err) {
    const status = err.response?.status || 502;
    const detail =
      err.response?.data?.detail || err.message || 'Inference call failed';
    const httpError = new Error(
      `Inference service error (${status}): ${detail}`
    );
    httpError.statusCode = status >= 400 && status < 500 ? status : 502;
    httpError.code = 'INFERENCE_FAILED';
    throw httpError;
  }
}

async function health() {
  try {
    const response = await client.get('/health');
    return response.data;
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

module.exports = { predict, health };

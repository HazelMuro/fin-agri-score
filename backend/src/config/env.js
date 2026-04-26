require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  /** Min 16 chars to enable JWT auth; unset = open API for local demos */
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL,
  inferenceServiceUrl:
    process.env.INFERENCE_SERVICE_URL || 'http://localhost:8000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  artifactsDir: process.env.ARTIFACTS_DIR || '../artifacts/output',
  finAgriScoreMin: parseInt(process.env.FIN_AGRI_SCORE_MIN || '300', 10),
  finAgriScoreMax: parseInt(process.env.FIN_AGRI_SCORE_MAX || '850', 10),
  riskBandLowMin: parseInt(process.env.RISK_BAND_LOW_MIN || '700', 10),
  riskBandMediumMin: parseInt(process.env.RISK_BAND_MEDIUM_MIN || '550', 10),
};

module.exports = env;

const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const c = require('../controllers/supportingController');

const router = Router();

const farmActivitySchema = z.object({
  farmerId: z.string(),
  cropType: z.string().optional(),
  estimatedYield: z.number().optional(),
  irrigation: z.string().optional(),
  season: z.string().optional(),
  inputUsage: z.string().optional(),
});

const assetSchema = z.object({
  farmerId: z.string(),
  assetType: z.string(),
  assetName: z.string(),
  quantity: z.number().optional(),
  estimatedValue: z.number().optional(),
});

const socialCapitalSchema = z.object({
  farmerId: z.string(),
  groupMembership: z.boolean().optional(),
  groupName: z.string().optional(),
  yearsInGroup: z.number().int().optional(),
  leadershipRole: z.string().optional(),
  guarantorAvailable: z.boolean().optional(),
});

const satelliteSchema = z.object({
  applicationId: z.string(),
  rainfall30dMm: z.number().optional(),
  rainfall90dMm: z.number().optional(),
  rainfallAnomaly: z.number().optional(),
  ndvi90dMean: z.number().optional(),
  ndvi90dStd: z.number().optional(),
  environmentScore: z.number().optional(),
  environmentRisk: z.string().optional(),
  observationDate: z.coerce.date().optional(),
  source: z.string().optional(),
});

const userSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional(),
});

const householdIncomeSchema = z.object({
  farmerId: z.string(),
  mainSource: z.string().optional(),
  mainAmount: z.number().nonnegative().optional(),
  secondarySource: z.string().optional(),
  secondaryAmount: z.number().nonnegative().optional(),
  thirdSource: z.string().optional(),
  thirdAmount: z.number().nonnegative().optional(),
  shockExperienced: z.boolean().optional(),
  copingIndex: z.number().int().min(1).max(4).optional(),
  dietaryDiversity: z.number().int().min(0).max(12).optional(),
});

router.post('/farm-activities', validate({ body: farmActivitySchema }), c.createFarmActivity);
router.post('/assets', validate({ body: assetSchema }), c.createAsset);
router.post('/social-capital', validate({ body: socialCapitalSchema }), c.createSocialCapital);
router.post('/satellite-data', validate({ body: satelliteSchema }), c.createSatelliteData);
router.post('/household-income', validate({ body: householdIncomeSchema }), c.upsertHouseholdIncome);
router.post('/users', validate({ body: userSchema }), c.createUser);
const auditLogSchema = z.object({
  applicationId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  action: z.string().min(1),
  details: z.any().optional(),
});

router.get('/audit-logs', c.listAuditLogs);
router.post('/audit-logs', validate({ body: auditLogSchema }), c.createAuditLog);

module.exports = router;

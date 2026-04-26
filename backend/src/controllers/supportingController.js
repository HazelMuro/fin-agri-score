/**
 * CRUD for the supporting farmer records plus users and audit-log reads.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

async function createFarmActivity(req, res) {
  const record = await prisma.farmActivity.create({ data: req.body });
  res.status(201).json(record);
}

async function createAsset(req, res) {
  const record = await prisma.asset.create({ data: req.body });
  res.status(201).json(record);
}

async function createSocialCapital(req, res) {
  const record = await prisma.socialCapital.create({ data: req.body });
  res.status(201).json(record);
}

async function createSatelliteData(req, res) {
  const record = await prisma.satelliteData.create({ data: req.body });
  res.status(201).json(record);
}

async function createUser(req, res) {
  const { username, email, password, role } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, passwordHash, role: role || 'LOAN_OFFICER' },
    select: { id: true, username: true, email: true, role: true, active: true, createdAt: true },
  });
  res.status(201).json(user);
}

async function upsertHouseholdIncome(req, res) {
  const { farmerId, ...rest } = req.body;
  const record = await prisma.householdIncome.upsert({
    where: { farmerId },
    update: rest,
    create: { farmerId, ...rest },
  });
  res.status(201).json(record);
}

async function listAuditLogs(req, res) {
  const { applicationId, take = 50 } = req.query;
  const where = {};
  if (applicationId) where.applicationId = applicationId;

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Number(take),
  });
  res.json({ items });
}

/** Manual audit entry (e.g. operator notes) — uses same table as system events. */
async function createAuditLog(req, res) {
  const { applicationId, userId, action, details } = req.body;
  const log = await prisma.auditLog.create({
    data: {
      applicationId: applicationId || null,
      userId: userId || null,
      action: action || 'NOTE_ADDED',
      details: details || {},
    },
  });
  res.status(201).json(log);
}

module.exports = {
  createFarmActivity,
  createAsset,
  createSocialCapital,
  createSatelliteData,
  createUser,
  upsertHouseholdIncome,
  listAuditLogs,
  createAuditLog,
};

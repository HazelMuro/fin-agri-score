/**
 * Loan applications: list/filter, get detail, create, status updates. Audit log on create/status change.
 */

const prisma = require('../config/prisma');
const auditService = require('../services/auditService');

async function list(req, res) {
  const { status, farmerId, take = 50, skip = 0 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (farmerId) where.farmerId = farmerId;

  const [items, total] = await Promise.all([
    prisma.loanApplication.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Number(take),
      skip: Number(skip),
      include: {
        farmer: { select: { id: true, fullName: true, district: true } },
        creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.loanApplication.count({ where }),
  ]);

  res.json({ items, total });
}

async function getOne(req, res) {
  const app = await prisma.loanApplication.findUnique({
    where: { id: req.params.id },
    include: {
      farmer: true,
      creditScores: { orderBy: { createdAt: 'desc' } },
      satelliteData: { orderBy: { createdAt: 'desc' }, take: 1 },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!app) return res.status(404).json({ error: { message: 'Application not found' } });
  res.json(app);
}

async function create(req, res) {
  const app = await prisma.loanApplication.create({
    data: req.body,
    include: { farmer: { select: { fullName: true } } },
  });

  await auditService.log({
    applicationId: app.id,
    action: 'APPLICATION_CREATED',
    details: { amountRequested: app.amountRequested, purpose: app.purpose },
  });

  res.status(201).json(app);
}

async function updateStatus(req, res) {
  const { status } = req.body;
  const app = await prisma.loanApplication.update({
    where: { id: req.params.id },
    data: { status },
  });

  await auditService.log({
    applicationId: app.id,
    action: 'STATUS_CHANGED',
    details: { status },
  });

  res.json(app);
}

module.exports = { list, getOne, create, updateStatus };

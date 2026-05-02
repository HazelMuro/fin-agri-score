/**
 * Farmers CRUD: list/search, get one with related data, create (duplicate checks), update, delete.
 */

const prisma = require('../config/prisma');
const environmentService = require('../services/environmentService');

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

async function list(req, res) {
  const { q, district, take = 50, skip = 0 } = req.query;
  const where = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { nationalId: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (district) where.district = district;

  const [items, total] = await Promise.all([
    prisma.farmer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(take),
      skip: Number(skip),
      include: { _count: { select: { applications: true } } },
    }),
    prisma.farmer.count({ where }),
  ]);

  res.json({ items, total });
}

async function getOne(req, res) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: req.params.id },
    include: {
      applications: {
        orderBy: { createdAt: 'desc' },
        include: {
          creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      farmActivities: { orderBy: { createdAt: 'desc' } },
      assets: { orderBy: { createdAt: 'desc' } },
      socialCapital: { orderBy: { createdAt: 'desc' } },
      householdIncome: true,
    },
  });
  if (!farmer) return res.status(404).json({ error: { message: 'Farmer not found' } });
  res.json(farmer);
}

async function create(req, res) {
  const payload = req.body || {};
  if (payload.nationalId) {
    const byNationalId = await prisma.farmer.findFirst({
      where: {
        nationalId: {
          equals: payload.nationalId,
          mode: 'insensitive',
        },
      },
      select: { id: true, fullName: true },
    });
    if (byNationalId) {
      return res.status(409).json({
        error: {
          message: `A farmer with this national ID already exists (${byNationalId.fullName}).`,
          code: 'DUPLICATE_FARMER',
        },
      });
    }
  }

  if (payload.fullName && payload.phone) {
    const candidates = await prisma.farmer.findMany({
      where: {
        fullName: {
          equals: payload.fullName,
          mode: 'insensitive',
        },
      },
      select: { id: true, fullName: true, phone: true },
      take: 10,
    });
    const incoming = normalizePhone(payload.phone);
    const dup = candidates.find((c) => c.phone && normalizePhone(c.phone) === incoming);
    if (dup) {
      return res.status(409).json({
        error: {
          message: `A farmer with this name and phone already exists (${dup.fullName}).`,
          code: 'DUPLICATE_FARMER',
        },
      });
    }
  }

  const farmer = await prisma.farmer.create({ data: req.body });
  res.status(201).json(farmer);
}

async function update(req, res) {
  const farmer = await prisma.farmer.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(farmer);
}

async function remove(req, res) {
  await prisma.farmer.delete({ where: { id: req.params.id } });
  res.status(204).end();
}

async function getEnvironmentPreview(req, res) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: req.params.id },
  });
  if (!farmer) return res.status(404).json({ error: { message: 'Farmer not found' } });

  const resolved = await environmentService.resolveEnvironmentalData({
    province: farmer.province,
    district: farmer.district,
    applicationId: `preview-${farmer.id.slice(0, 8)}`,
  });

  res.json(resolved);
}

module.exports = { list, getOne, create, update, remove, getEnvironmentPreview };

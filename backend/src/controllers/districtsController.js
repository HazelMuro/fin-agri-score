const prisma = require('../config/prisma');

async function list(req, res) {
  const { province } = req.query;
  const where = province ? { province } : {};
  const items = await prisma.districtProfile.findMany({
    where,
    orderBy: [{ province: 'asc' }, { district: 'asc' }],
  });
  res.json({ items });
}

module.exports = { list };

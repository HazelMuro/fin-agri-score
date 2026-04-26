const prisma = require('../config/prisma');

async function log({ applicationId = null, userId = null, action, details = null }) {
  try {
    await prisma.auditLog.create({
      data: { applicationId, userId, action, details },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

module.exports = { log };

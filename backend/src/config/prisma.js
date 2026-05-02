/**
 * Singleton Prisma client for Postgres. Reuses one instance in development to avoid connection storms.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma || new PrismaClient();


if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;

#!/usr/bin/env node
/**
 * Prints what Postgres session Prisma opens using DATABASE_URL (from backend/.env).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  let parsed;
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'));
    console.log('From DATABASE_URL (parsed):');
    console.log('  Host:', u.hostname);
    console.log('  Port:', u.port || '(default 5432)');
    console.log('  Database:', u.pathname.replace(/^\//, '').split('?')[0] || '(none)');
    console.log('  User:', decodeURIComponent(u.username || ''));
    console.log('');
  } catch {
    console.log('(Could not parse DATABASE_URL as URL — still querying Postgres.)\n');
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        current_database() AS database,
        current_user AS connected_as,
        inet_server_port() AS server_port,
        version() AS postgres_version
    `;
    console.log('Live PostgreSQL session (authoritative):');
    console.log(rows[0]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

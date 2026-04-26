/**
 * Auth API (P9) — requires DATABASE_URL, JWT_SECRET (≥16 chars), and seeded users (`npm run seed`).
 */
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const hasJwt =
  process.env.DATABASE_URL &&
  process.env.JWT_SECRET &&
  String(process.env.JWT_SECRET).length >= 16;

const describeAuth = hasJwt ? describe : describe.skip;

describeAuth('POST /api/auth/login', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns a JWT for seeded loan.officer', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loan.officer', password: 'officer123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user?.username).toBe('loan.officer');
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loan.officer', password: 'not-the-password' });
    expect(res.status).toBe(401);
  });
});

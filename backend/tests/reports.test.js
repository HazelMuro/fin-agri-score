/**
 * Integration smoke tests for CSV/PDF report routes (P8).
 * Set DATABASE_URL (e.g. from backend/.env) so Prisma can reach PostgreSQL.
 * When JWT_SECRET (≥16 chars) is set, Bearer auth is required — uses seeded `loan.officer` / `officer123`.
 */
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('GET /api/reports', () => {
  let authHeaders = {};

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET;
    if (secret && String(secret).length >= 16) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loan.officer', password: 'officer123' });
      if (res.status === 200 && res.body?.token) {
        authHeaders = { Authorization: `Bearer ${res.body.token}` };
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applications.csv returns CSV with header row', async () => {
    const res = await request(app).get('/api/reports/applications.csv').set(authHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/i);
    expect(res.text).toMatch(/application_id/);
  });

  it('score-history.csv returns CSV with header row', async () => {
    const res = await request(app).get('/api/reports/score-history.csv').set(authHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/i);
    expect(res.text).toMatch(/fin_agri_score/);
  });

  it('portfolio-summary.pdf returns a PDF attachment', async () => {
    const res = await request(app).get('/api/reports/portfolio-summary.pdf').set(authHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/i);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
    const raw = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text, 'binary');
    expect(raw.length).toBeGreaterThan(500);
    expect(raw.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('application summary pdf returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/reports/applications/clidnonexistent000/summary.pdf')
      .set(authHeaders);
    expect(res.status).toBe(404);
  });
});

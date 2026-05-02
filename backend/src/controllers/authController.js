/**
 * JWT login (when JWT_SECRET set) and GET /auth/me for session bootstrap.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { signAccessToken } = require('../utils/jwt');

async function login(req, res) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 16) {
    return res.status(503).json({
      error: { message: 'Login is disabled until JWT_SECRET is set (min 16 characters).' },
    });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: { message: 'username and password are required' } });
  }

  const user = await prisma.user.findUnique({
    where: { username: String(username).trim() },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: { message: 'Invalid credentials' } });
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: { message: 'Invalid credentials' } });
  }

  const token = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}

async function me(req, res) {
  if (req.user?.authDisabled) {
    return res.json({ user: null, auth: 'disabled' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, role: true, active: true, createdAt: true },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: { message: 'Session no longer valid' } });
  }
  res.json({ user, auth: 'jwt' });
}

module.exports = { login, me };

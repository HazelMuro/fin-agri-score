/**
 * Attach req.user on every protected route. Open demo: no JWT_SECRET → synthetic LOAN_OFFICER user.
 */

const { verifyAccessToken } = require('../utils/jwt');

/**
 * When JWT_SECRET is unset or shorter than 16 chars, authentication is **off**
 * (anonymous loan-officer persona for local demos). Set a strong JWT_SECRET in
 * production and in Docker Compose.
 */
function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 16) {
    req.user = { id: null, username: 'anonymous', role: 'LOAN_OFFICER', authDisabled: true };
    return next();
  }

  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing or invalid authorization header' } });
  }
  const raw = hdr.slice(7).trim();
  if (!raw) {
    return res.status(401).json({ error: { message: 'Missing bearer token' } });
  }
  try {
    const payload = verifyAccessToken(raw);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      authDisabled: false,
    };
    return next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
}

module.exports = { requireAuth };

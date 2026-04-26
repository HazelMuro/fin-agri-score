const jwt = require('jsonwebtoken');

const DEFAULT_EXPIRES = '7d';

function signAccessToken({ sub, username, role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 characters) to sign tokens');
  }
  return jwt.sign(
    { username, role },
    secret,
    {
      subject: sub,
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES,
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAccessToken, verifyAccessToken };

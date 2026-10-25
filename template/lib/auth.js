// Signed session cookie (HMAC-SHA256), access codes, and a small per-IP attempt limiter.
'use strict';
const crypto = require('crypto');

const COOKIE = 'hs_session';
const MAX_AGE = 60 * 60 * 24 * 14; // two weeks: codes go out well before the day

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Falling back to DATABASE_URL used to hide a missing secret: sessions would be signed with the
  // connection string, so rotating the database silently signed everyone out. Fail loudly instead.
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set: add it to the Vercel project.');
  }
  return 'local-dev-secret-not-for-production';
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch (e) { return null; }
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('='); if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function session(req) { return verify(parseCookies(req.headers.cookie)[COOKIE]); }
function setSession(res, payload, secure) {
  const token = sign(Object.assign({ exp: Math.floor(Date.now() / 1000) + MAX_AGE }, payload));
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Codes: 8 characters from an alphabet without look-alikes, shown as XXXX-XXXX.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  const bytes = crypto.randomBytes(8); let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}
function normaliseCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : s;
}

module.exports = { session, setSession, clearSession, newCode, normaliseCode };

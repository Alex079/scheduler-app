import jwt from 'jsonwebtoken';
import { login } from '../db/db.js';
import { randomUUID } from 'crypto';

const SECRET = process.env.JWT_SECRET ?? randomUUID();
if (!process.env.JWT_SECRET) {
  console.warn(
    'JWT_SECRET is not set; using a random secret. All sessions will be invalidated on restart. Set JWT_SECRET in production.'
  );
}

export function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  function handle(err, decoded) {
      if (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.userId = decoded.id;
      req.username = decoded.username;
      next();
    }

  jwt.verify(token, SECRET, handle);
}

// Fixed-window rate limiter to slow down credential brute-forcing.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 20;
const loginAttempts = new Map(); // ip -> { count, resetAt }

export function loginRateLimit(req, res, next) {
  const now = Date.now();

  // Opportunistically drop expired entries so the map cannot grow unbounded.
  if (loginAttempts.size > 1000) {
    for (const [ip, entry] of loginAttempts) {
      if (entry.resetAt <= now) loginAttempts.delete(ip);
    }
  }

  const entry = loginAttempts.get(req.ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(req.ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  return next();
}

export function performLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  function checkUserId(id) {
    if (!id) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    loginAttempts.delete(req.ip); // successful login clears the counter
    const token = jwt.sign({ id, username }, SECRET, { expiresIn: '24h' });
    return res.status(200).json({ token, userId: id, username });
  }

  return checkUserId(login(username, password));
}

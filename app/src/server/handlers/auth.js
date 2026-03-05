import jwt from 'jsonwebtoken';
import { login } from '../db/db.js';

const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

export function performLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  function checkUserId(id) {
    if (!id) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id, username }, SECRET, { expiresIn: '24h' });
    return res.status(200).json({ token, userId: id, username });
  }

  return checkUserId(login(username, password));
}

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';

export const setAuthCookie = (res, user) => {
  const t = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('as_token', t, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 7 * 864e5 });
};

export async function requireAuth(req, res, next) {
  try {
    const t = req.cookies?.as_token;
    if (!t) return res.status(401).json({ error: 'Authentication required' });
    const p = jwt.verify(t, config.jwtSecret);
    const u = await User.findById(p.id).select('-password');
    if (!u) return res.status(401).json({ error: 'Account not found' });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Administrator role required' });

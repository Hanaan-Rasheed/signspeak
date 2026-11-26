import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, type Role } from './store.js';

export type Identity = { id: string; role: Role };
declare global { namespace Express { interface Request { identity?: Identity } } }
const secret = process.env.JWT_SECRET ?? '';
export function makeToken(identity: Identity) { return jwt.sign(identity, secret, { expiresIn: '7d' }); }
export function verifyToken(token: string): Identity {
  const value = jwt.verify(token, secret) as Identity;
  const user = db.users().find(u => u.id === value.id);
  if (!user || user.role !== value.role) throw new Error('Invalid user');
  return { id: user.id, role: user.role };
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /i, '');
    if (!token) { res.status(401).json({ error: 'Please sign in first.' }); return; }
    req.identity = verifyToken(token);
    next();
  } catch { res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}

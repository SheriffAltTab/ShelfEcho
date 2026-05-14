import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shelfecho-secret-key-change-in-production';

export type UserRole = 'user' | 'moderator' | 'content_manager' | 'superadmin';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: UserRole;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;

    // Check if user is blocked
    const user = db.prepare('SELECT role, blocked, is_active FROM users WHERE id = ?').get(decoded.userId) as any;
    if (user?.blocked) {
      res.status(403).json({ error: 'Account is blocked' });
      return;
    }
    if (user && Number(user.is_active) === 0) {
      res.status(403).json({ error: 'Please verify your email address before continuing.' });
      return;
    }
    req.userRole = (user?.role || 'user') as UserRole;

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function roleMiddleware(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

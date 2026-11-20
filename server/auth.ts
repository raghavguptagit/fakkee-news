import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

const JWT_SECRET = process.env.APP_SECRET_KEY || 'truthlens-dev-secret-change-in-production';
const TOKEN_EXPIRY = '7d';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, display_name: user.display_name, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to continue.',
        details: {},
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; display_name: string; role: 'user' | 'admin' };
    const db = getDb();
    const row = db
      .prepare('SELECT id, email, display_name, role, is_active FROM users WHERE id = ?')
      .get(decoded.sub) as (AuthUser & { is_active: number }) | undefined;

    if (!row || !row.is_active) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session is invalid or account is inactive.',
          details: {},
        },
      });
      return;
    }

    req.user = {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
    };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Your session has expired. Please sign in again.',
        details: {},
      },
    });
  }
}

// Simple in-memory sliding-window rate limiter
const rateBuckets = new Map<string, number[]>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      next();
      return;
    }
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
          details: { retry_after_seconds: Math.ceil(windowMs / 1000) },
        },
      });
      return;
    }
    timestamps.push(now);
    rateBuckets.set(key, timestamps);
    next();
  };
}

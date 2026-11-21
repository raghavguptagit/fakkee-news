import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.APP_SECRET_KEY && process.env.APP_SECRET_KEY.trim().length >= 16
  ? process.env.APP_SECRET_KEY
  : EPHEMERAL_SECRET;
const TOKEN_EXPIRY = '7d';
export const SESSION_COOKIE_NAME = 'truthlens_session';

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

export function setAuthCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    ...(isHttps ? { partitioned: true } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    ...(isHttps ? { partitioned: true } : {}),
    path: '/',
  });
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

function verifyCsrfForCookieMutation(req: Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
  if (req.headers['x-requested-with'] === 'TruthLens') return true;
  const origin = req.headers.origin;
  const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  if (origin && expectedHost) {
    try {
      return new URL(origin).host === expectedHost;
    } catch {
      return false;
    }
  }
  return false;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = !bearerToken ? parseCookieValue(req.headers.cookie, SESSION_COOKIE_NAME) : null;
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Please sign in to access your saved workspace.',
        details: {},
      },
    });
    return;
  }

  if (cookieToken && !bearerToken && !verifyCsrfForCookieMutation(req)) {
    res.status(403).json({
      error: {
        code: 'CSRF_CHECK_FAILED',
        message: 'Request origin verification failed.',
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
          message: 'Your session is no longer valid. Please sign in again.',
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
          message: 'Too many requests right now. Please wait a moment and try again.',
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

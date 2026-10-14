import type { NextFunction, Request, Response } from 'express';
import { parse } from 'cookie';
import { AuthService, type AuthenticatedUser } from '../../services/auth.service.js';
import { AUTH_COOKIE_NAME, verifySessionToken } from '../../services/auth.session.js';

const sendUnauthorized = (res: Response): void => {
  res.status(401).json({
    error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
  });
};

const sendForbidden = (res: Response): void => {
  res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
  });
};

/**
 * Resolves the signed session cookie to a user. Shared with the speech WebSocket handshake, which
 * has a raw `IncomingMessage` rather than an Express request but the same cookie.
 */
export const loadAuthenticatedUserFromCookieHeader = async (
  cookieHeader: string | undefined,
): Promise<AuthenticatedUser | null> => {
  const cookies = parse(cookieHeader ?? '');
  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const claims = await verifySessionToken(token);
  return AuthService.findAuthenticatedUserById(claims.sub);
};

const loadAuthenticatedUser = (req: Request): Promise<AuthenticatedUser | null> =>
  loadAuthenticatedUserFromCookieHeader(req.headers.cookie);

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await loadAuthenticatedUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    req.user = user;
    next();
  } catch {
    sendUnauthorized(res);
  }
};

/**
 * An employee account is refused here even when `is_pet_owner` is also set on
 * it. Staff who want to board their own pet register a separate pet parent
 * account, so a staff session can never be holding a parent's records - and
 * the gate that decides that lives on the server, not only in the router.
 */
export const requirePetParent = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireAuth(req, res, () => {
    if (req.user?.is_pet_owner !== true || req.user.is_employee === true) {
      sendForbidden(res);
      return;
    }
    next();
  });
};

export const requireEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireAuth(req, res, () => {
    if (req.user?.is_employee !== true) {
      sendForbidden(res);
      return;
    }
    next();
  });
};

export const requireManager = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireEmployee(req, res, () => {
    if (req.user?.employee_role !== 'manager') {
      sendForbidden(res);
      return;
    }
    next();
  });
};

const getAllowedOrigins = (): string[] =>
  process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('origin');
  if (!origin || getAllowedOrigins().includes(origin)) {
    next();
    return;
  }

  res.status(403).json({
    error: { code: 'UNTRUSTED_ORIGIN', message: 'Request origin is not allowed' },
  });
};

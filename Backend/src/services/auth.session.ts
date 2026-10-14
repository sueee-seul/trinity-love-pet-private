import type { JWTPayload } from 'jose';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../common/utils/signed-session.js';

export const AUTH_COOKIE_NAME = 'wagstay_session';
export const AUTH_SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface AuthSessionClaims {
  sub: string;
  sv: string;
  iat: number;
  exp: number;
}

const getSessionSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
};

export const getAuthSessionCookieOptions = (): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
  path: '/';
} => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: AUTH_SESSION_TTL_SECONDS * 1000,
  path: '/',
});

const getSessionVersion = (): string => process.env.AUTH_SESSION_VERSION ?? '1';

export const createSessionToken = async (
  userId: string,
  issuedAt = new Date(),
): Promise<string> => {
  return createSignedSessionToken({
    subject: userId,
    secret: getSessionSecret(),
    ttlSeconds: AUTH_SESSION_TTL_SECONDS,
    claims: { sv: getSessionVersion() },
    issuedAt,
  });
};

const isSessionPayload = (payload: JWTPayload): payload is JWTPayload & AuthSessionClaims => {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.sv === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number' &&
    payload.sv === getSessionVersion()
  );
};

export const verifySessionToken = async (token: string): Promise<AuthSessionClaims> => {
  const payload = await verifySignedSessionToken({
    token,
    secret: getSessionSecret(),
    requiredClaims: ['sub', 'iat', 'exp', 'sv'],
    invalidClaimsMessage: 'Invalid auth session claims',
    isValidClaims: isSessionPayload,
  });

  return {
    sub: payload.sub,
    sv: payload.sv,
    iat: payload.iat,
    exp: payload.exp,
  };
};

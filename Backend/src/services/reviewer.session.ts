import type { JWTPayload } from 'jose';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../common/utils/signed-session.js';
import type { ReviewerProfile } from './reviewer.service.js';

export const REVIEWER_COOKIE_NAME = 'maps_reviewer_session';
export const REVIEWER_SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface ReviewerSessionClaims {
  sub: string;
  displayName: string;
  avatarUrl: string | null;
  iat: number;
  exp: number;
}

const getReviewerSessionSecret = (): Uint8Array => {
  const secret = process.env.REVIEWER_SESSION_SECRET;
  if (!secret) {
    throw new Error('REVIEWER_SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
};

export const getReviewerSessionCookieOptions = (): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
  path: '/';
} => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: REVIEWER_SESSION_TTL_SECONDS * 1000,
  path: '/',
});

const isReviewerSessionPayload = (
  payload: JWTPayload,
): payload is JWTPayload & ReviewerSessionClaims =>
  typeof payload.sub === 'string' &&
  typeof payload.displayName === 'string' &&
  payload.displayName.trim().length > 0 &&
  (payload.avatarUrl === null || typeof payload.avatarUrl === 'string') &&
  typeof payload.iat === 'number' &&
  typeof payload.exp === 'number';

export const createReviewerSessionToken = async (
  reviewer: ReviewerProfile,
  issuedAt = new Date(),
): Promise<string> =>
  createSignedSessionToken({
    subject: reviewer.id,
    secret: getReviewerSessionSecret(),
    ttlSeconds: REVIEWER_SESSION_TTL_SECONDS,
    claims: {
      displayName: reviewer.displayName,
      avatarUrl: reviewer.avatarUrl,
    },
    issuedAt,
  });

export const verifyReviewerSessionToken = async (token: string): Promise<ReviewerSessionClaims> => {
  const payload = await verifySignedSessionToken({
    token,
    secret: getReviewerSessionSecret(),
    requiredClaims: ['sub', 'displayName', 'avatarUrl', 'iat', 'exp'],
    invalidClaimsMessage: 'Invalid reviewer session claims',
    isValidClaims: isReviewerSessionPayload,
  });

  return {
    sub: payload.sub,
    displayName: payload.displayName,
    avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : null,
    iat: payload.iat,
    exp: payload.exp,
  };
};

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';
import {
  AUTH_SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from '../services/auth.session.js';

const USER_UUID = '00000000-0000-4000-8000-000000000201';

describe('auth session token', () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = 'session-test-secret';
    process.env.AUTH_SESSION_VERSION = '1';
  });

  afterEach(() => {
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_VERSION;
  });

  it('signs only the approved session claims', async () => {
    const issuedAt = new Date(Date.now() - 1000);
    const token = await createSessionToken(USER_UUID, issuedAt);
    const claims = decodeJwt(token);

    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub', 'sv']);
    expect(claims).toMatchObject({
      sub: USER_UUID,
      sv: '1',
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(issuedAt.getTime() / 1000) + AUTH_SESSION_TTL_SECONDS,
    });
    await expect(verifySessionToken(token)).resolves.toMatchObject({ sub: USER_UUID, sv: '1' });
  });

  it('rejects tampered, expired, and version-mismatched tokens', async () => {
    const token = await createSessionToken(USER_UUID);
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new Error('Expected a three-part JWT');
    }
    const replacement = signature[0] === 'a' ? 'b' : 'a';
    const tamperedToken = [header, payload, `${replacement}${signature.slice(1)}`].join('.');
    await expect(verifySessionToken(tamperedToken)).rejects.toThrow();

    const expiredToken = await createSessionToken(
      USER_UUID,
      new Date(Date.now() - (AUTH_SESSION_TTL_SECONDS + 1) * 1000),
    );
    await expect(verifySessionToken(expiredToken)).rejects.toThrow();

    process.env.AUTH_SESSION_VERSION = '2';
    await expect(verifySessionToken(token)).rejects.toThrow();
  });
});

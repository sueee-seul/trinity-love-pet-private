import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exchangeGoogleAuthorizationCode,
  verifyGoogleIdToken,
} from '../services/google-token.verifier.js';

const { getTokenMock, verifyIdTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn(),
  verifyIdTokenMock: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class MockOAuth2Client {
    public getToken(...args: unknown[]): unknown {
      return getTokenMock(...args);
    }

    public verifyIdToken(...args: unknown[]): unknown {
      return verifyIdTokenMock(...args);
    }
  },
}));

describe('Google token verifier', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    verifyIdTokenMock.mockReset();
  });

  it('exchanges an authorization code for a Google ID token', async () => {
    getTokenMock.mockResolvedValueOnce({ tokens: { id_token: 'exchanged-id-token' } });

    await expect(
      exchangeGoogleAuthorizationCode(
        'authorization-code',
        'client-id',
        'client-secret',
        'http://localhost:5173',
      ),
    ).resolves.toBe('exchanged-id-token');
    expect(getTokenMock).toHaveBeenCalledWith({
      code: 'authorization-code',
      redirect_uri: 'http://localhost:5173',
    });
  });

  it('maps only typed Google identity fields from the verified payload', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'reviewer@example.test',
        name: 'Google Reviewer',
        picture: 'https://example.test/avatar.png',
        email_verified: true,
        given_name: 'Google',
        family_name: 'Reviewer',
        hd: 'example.test',
      }),
    });

    await expect(verifyGoogleIdToken('id-token', 'client-id')).resolves.toEqual({
      subject: 'google-subject',
      email: 'reviewer@example.test',
      name: 'Google Reviewer',
      picture: 'https://example.test/avatar.png',
      email_verified: true,
      given_name: 'Google',
      family_name: 'Reviewer',
    });
    expect(verifyIdTokenMock).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' });
  });

  it('returns null when the verified ticket has no payload', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => undefined });

    await expect(verifyGoogleIdToken('id-token', 'client-id')).resolves.toBeNull();
  });
});

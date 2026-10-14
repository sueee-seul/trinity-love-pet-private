import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './authApi';

describe('authApi session transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses cookie credentials and expects login user data without a token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { id: 'user-1', email: 'parent@example.test' } } }),
    } as Response);

    const result = await authApi.loginWithPassword('parent@example.test', 'Password1!');

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result.data.data).not.toHaveProperty('token');
  });

  it('hydrates the current user and clears the cookie through auth endpoints', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { user: { id: 'user-1', email: 'parent@example.test' } } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { loggedOut: true } }),
      } as Response);

    await expect(authApi.getCurrentUser()).resolves.toMatchObject({
      data: { data: { user: { id: 'user-1' } } },
    });
    await expect(authApi.logout()).resolves.toMatchObject({ ok: true });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('posts temporary password changes with cookie credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { passwordChanged: true } }),
    } as Response);

    await expect(
      authApi.completeTemporaryPassword('NewSecure1!', 'NewSecure1!'),
    ).resolves.toMatchObject({
      ok: true,
      data: { data: { passwordChanged: true } },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/first-login-password'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('reads the rule errors of a rejected password instead of throwing', async () => {
    const fieldErrors = {
      password: [
        { code: 'PASSWORD_MISSING_SYMBOL', message: 'Password must contain at least one symbol.' },
      ],
    };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 400, msg: 'Password validation failed', data: { fieldErrors } }),
    } as Response);

    await expect(authApi.completeTemporaryPassword('NewSecure1', 'NewSecure1')).resolves.toEqual({
      ok: false,
      data: { msg: 'Password validation failed', data: { fieldErrors } },
    });
  });
});

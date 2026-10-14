import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from './notificationPreferencesApi';
import { ParentProfileApiError } from './parentProfileApi';

const SAVED = {
  preferences: { locale: 'zh', digestHour: 18, quietStart: 21, quietEnd: 8, emailUpdates: false },
  saved: true,
};

const answer = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('notification preferences transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the preferences with the session cookie and names no parent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(answer(200, SAVED));

    await expect(fetchNotificationPreferences()).resolves.toEqual(SAVED);

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/api\/parent\/profile\/notification-preferences$/);
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('PUTs only the fields given, as JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(answer(200, SAVED));

    await updateNotificationPreferences({ digestHour: 18 });

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(init).toMatchObject({
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({ digestHour: 18 });
  });

  it('lifts the server reason out of a refused write', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      answer(400, { error: { message: 'digestHour must be between 0 and 23' } }),
    );

    await expect(updateNotificationPreferences({ digestHour: 24 })).rejects.toMatchObject({
      name: 'ParentProfileApiError',
      status: 400,
      message: 'digestHour must be between 0 and 23',
    });
  });

  it('refuses an answer that is not the preferences shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      answer(200, { preferences: { locale: 'fr' }, saved: true }),
    );

    await expect(fetchNotificationPreferences()).rejects.toBeInstanceOf(ParentProfileApiError);
  });
});

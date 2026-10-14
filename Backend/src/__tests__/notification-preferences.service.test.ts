import { describe, expect, it, vi } from 'vitest';
import {
  isQuietHour,
  preferencesForOwner,
  updatePreferencesForOwner,
} from '../services/notification-preferences.service.js';
import {
  readNotificationPreferences,
  upsertNotificationPreferences,
} from '../repositories/notification-preferences.repository.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../contracts/notification.preferences.contract.js';

vi.mock('../repositories/notification-preferences.repository.js', () => ({
  readNotificationPreferences: vi.fn(async () => null),
  upsertNotificationPreferences: vi.fn(async (_owner: string, update: Record<string, unknown>) => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...update,
  })),
}));

/** 23:30 and 06:30 and 12:00 in Auckland on 13 Dec 2026 (NZDT, UTC+13). */
const LATE_NIGHT = new Date('2026-12-13T10:30:00Z');
const EARLY_MORNING = new Date('2026-12-12T17:30:00Z');
const MIDDAY = new Date('2026-12-12T23:00:00Z');

describe('quiet hours', () => {
  it('cover a window that crosses midnight, on the Auckland clock', () => {
    const quiet = { quietStart: 22, quietEnd: 7 };
    expect(isQuietHour(quiet, LATE_NIGHT)).toBe(true);
    expect(isQuietHour(quiet, EARLY_MORNING)).toBe(true);
    expect(isQuietHour(quiet, MIDDAY)).toBe(false);
  });

  it('cover a window inside one day, and nothing when start and end are equal', () => {
    expect(isQuietHour({ quietStart: 11, quietEnd: 13 }, MIDDAY)).toBe(true);
    expect(isQuietHour({ quietStart: 13, quietEnd: 15 }, MIDDAY)).toBe(false);
    expect(isQuietHour({ quietStart: 9, quietEnd: 9 }, MIDDAY)).toBe(false);
  });
});

describe('preferences for an owner', () => {
  it('read what is stored, or the defaults marked as never saved', async () => {
    await expect(preferencesForOwner('owner-1')).resolves.toEqual({
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      saved: false,
    });
    expect(readNotificationPreferences).toHaveBeenCalledWith('owner-1');
    vi.mocked(readNotificationPreferences).mockResolvedValueOnce({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      locale: 'zh',
    });
    await expect(preferencesForOwner('owner-1')).resolves.toMatchObject({
      preferences: { locale: 'zh' },
      saved: true,
    });
  });

  it('write only the fields the parent changed', async () => {
    await expect(
      updatePreferencesForOwner('owner-1', { locale: 'zh', digestHour: 19 }),
    ).resolves.toMatchObject({
      preferences: { locale: 'zh', digestHour: 19, quietStart: 22 },
      saved: true,
    });
    expect(upsertNotificationPreferences).toHaveBeenCalledWith('owner-1', {
      locale: 'zh',
      digestHour: 19,
    });
  });
});

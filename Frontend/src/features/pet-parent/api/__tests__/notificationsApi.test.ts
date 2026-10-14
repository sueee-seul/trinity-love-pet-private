import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationsApi';

// The wire format with Backend/src/routes/petparent.notifications.routes.ts. The bell test mocks
// this module, so the paths and bodies are held here.

const fetchMock = vi.fn<typeof fetch>();

const NOTICE = {
  id: 'notice-1',
  kind: 'booking_approved',
  title: 'Approved',
  body: "Max's stay, 12 to 15 Oct 2026, is approved.",
  facts: { template: 'approved', pets: ['Max'], dates: { start: '2026-10-12', end: '2026-10-15' } },
  createdAt: '2026-10-01T02:01:00.123Z',
  readAt: null,
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const lastCall = (): [string, RequestInit | undefined] => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return [String(call[0]), call[1]];
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notificationsApi', () => {
  it('loads the newest notices with the session cookie and no owner id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [NOTICE], unreadCount: 1 }));

    await expect(fetchNotifications()).resolves.toEqual({ items: [NOTICE], unreadCount: 1 });
  });

  // A server from before the facts sends none; the notice still lists, read as a general line.
  it('reads a notice without facts as having none', async () => {
    const withoutFacts = { ...NOTICE, facts: undefined };
    fetchMock.mockResolvedValue(jsonResponse({ items: [withoutFacts], unreadCount: 1 }));

    await expect(fetchNotifications()).resolves.toEqual({
      items: [{ ...NOTICE, facts: null }],
      unreadCount: 1,
    });

    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/petparent/notifications?limit=20');
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('refuses a list it cannot read rather than showing half a notice', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ items: [{ ...NOTICE, kind: 'something_else' }], unreadCount: 1 }),
    );

    await expect(fetchNotifications()).rejects.toThrow('We could not read your notifications.');
  });

  it('marks one notice read by its id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'notice 1', readAt: NOTICE.createdAt }));

    await markNotificationRead('notice 1');

    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/petparent/notifications/notice%201/read');
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
  });

  it('marks read only up to the newest notice the bell showed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updatedIds: ['notice-1'], readAt: null }));

    await markAllNotificationsRead(NOTICE.createdAt);

    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/petparent/notifications/read-all');
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' });
    expect(JSON.parse(String(init?.body))).toEqual({ through: NOTICE.createdAt });
  });
});

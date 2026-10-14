import { beforeEach, describe, expect, it, vi } from 'vitest';

// The manager bell carries "New booking request" notices next to the Google Review receipts.

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: poolQuery, connect: vi.fn() } }));

import {
  getManagerGoogleReviewNotifications,
  markManagerGoogleReviewNotificationAsRead,
  readAllManagerGoogleReviewNotifications,
} from '../services/admin.google.review.notification.service.js';

const MANAGER_ID = '00000000-0000-4000-8000-000000000304';
const BOOKING_ID = '00000000-0000-4000-8000-000000000501';
const CREATED_AT = new Date('2026-10-01T02:01:00.000Z');

const BOOKING_ROW = {
  uuid: '00000000-0000-4000-8000-000000000911',
  category: 'booking',
  review_uuid: null,
  reviewer_display_name: null,
  rating: null,
  booking_uuid: BOOKING_ID,
  summary_content: 'Max, 12 to 15 Oct 2026. Reference PB-000000.',
  notification_setting: 'booking_request_created',
  created_at: CREATED_AT,
  read_at: null,
};

const REVIEW_ROW = {
  uuid: '00000000-0000-4000-8000-000000000912',
  category: 'google_review',
  review_uuid: '00000000-0000-4000-8000-000000000701',
  reviewer_display_name: 'Sam',
  rating: 5,
  booking_uuid: null,
  summary_content: null,
  created_at: new Date('2026-09-30T02:01:00.000Z'),
  read_at: null,
};

const call = (index: number): { sql: string; params: unknown[] } => {
  const [sql, params] = poolQuery.mock.calls[index] ?? [];
  return { sql: String(sql), params: Array.isArray(params) ? params : [] };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('manager bell with booking requests', () => {
  it('lists a booking request with its own title, words and link target', async () => {
    poolQuery.mockImplementation(async (sql: string) =>
      sql.includes('unread_count')
        ? { rows: [{ unread_count: 2 }] }
        : { rows: [BOOKING_ROW, REVIEW_ROW] },
    );

    const page = await getManagerGoogleReviewNotifications(MANAGER_ID, { limit: 10 });

    expect(page.unreadCount).toBe(2);
    expect(page.items[0]).toEqual({
      id: BOOKING_ROW.uuid,
      type: 'booking_request_created',
      category: 'booking',
      title: 'New booking request',
      body: BOOKING_ROW.summary_content,
      createdAt: CREATED_AT.toISOString(),
      readAt: null,
      target: { kind: 'booking', bookingId: BOOKING_ID },
    });
    expect(page.items[1]).toMatchObject({
      category: 'google_review',
      title: 'New review from Sam',
      target: { kind: 'google_review', reviewId: REVIEW_ROW.review_uuid },
    });
  });

  it("scopes both kinds to the signed-in manager's own rows", async () => {
    poolQuery.mockResolvedValue({ rows: [] });

    await getManagerGoogleReviewNotifications(MANAGER_ID, { limit: 10 });

    const count = call(0);
    const list = call(1);
    expect(count.params).toEqual([
      MANAGER_ID,
      'google_review_created',
      'google_review',
      'review_received',
      'mock-pethouse-location',
      'booking',
      // New requests and "Decision due soon" reminders.
      ['booking_request_created', 'booking_review_due'],
    ]);
    expect(list.params).toEqual([...count.params, null, null, 11]);
    expect(list.sql.match(/notification\.assignee_uuid = \$1::uuid/g)).toHaveLength(2);
  });

  it('titles a review deadline reminder "Decision due soon"', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [{ unread_count: 1 }] }).mockResolvedValueOnce({
      rows: [{ ...BOOKING_ROW, notification_setting: 'booking_review_due' }],
    });

    const page = await getManagerGoogleReviewNotifications(MANAGER_ID, { limit: 10 });

    expect(page.items[0]).toMatchObject({
      type: 'booking_request_created',
      title: 'Decision due soon',
      target: { kind: 'booking', bookingId: BOOKING_ID },
    });
  });

  it('marks a booking request read for its manager only', async () => {
    const readAt = new Date('2026-10-02T00:00:00.000Z');
    poolQuery.mockResolvedValue({ rows: [{ uuid: BOOKING_ROW.uuid, read_at: readAt }] });

    await expect(
      markManagerGoogleReviewNotificationAsRead(BOOKING_ROW.uuid, MANAGER_ID),
    ).resolves.toEqual({ id: BOOKING_ROW.uuid, readAt: readAt.toISOString() });

    const { sql, params } = call(0);
    expect(sql).toContain('assignee_uuid = $2::uuid');
    expect(sql).toContain('(notification_setting = ANY($5::text[]) AND category = $6)');
    expect(params).toEqual([
      BOOKING_ROW.uuid,
      MANAGER_ID,
      'google_review_created',
      'google_review',
      ['booking_request_created', 'booking_review_due'],
      'booking',
    ]);
  });

  it('reads all of both kinds with every parameter used', async () => {
    poolQuery.mockResolvedValue({ rows: [] });

    await readAllManagerGoogleReviewNotifications(MANAGER_ID);

    const { sql, params } = call(0);
    expect(params).toHaveLength(5);
    for (let index = 1; index <= params.length; index += 1) {
      expect(sql).toContain(`$${index}`);
    }
    expect(params[0]).toBe(MANAGER_ID);
  });
});

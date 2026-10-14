import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteGoogleReviewNotifications,
  insertGoogleReviewReceiptNotifications,
} from '../repositories/google.review.notification.repository.js';
import { pool } from '../config/database.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const createClient = (): PoolClient => ({ query: vi.fn() }) as unknown as PoolClient;

describe('Google Review notification repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('writes one receipt event and one notification for every active manager', async () => {
    const client = createClient();
    const query = vi.mocked(client.query);
    query
      .mockResolvedValueOnce({ rows: [{ uuid: '00000000-0000-4000-8000-000000000901' }] } as never)
      .mockResolvedValueOnce({
        rows: [
          { uuid: '00000000-0000-4000-8000-000000000201' },
          { uuid: '00000000-0000-4000-8000-000000000202' },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { uuid: '00000000-0000-4000-8000-000000000911' },
          { uuid: '00000000-0000-4000-8000-000000000912' },
        ],
      } as never);

    await expect(
      insertGoogleReviewReceiptNotifications(client, {
        reviewUuid: '00000000-0000-4000-8000-000000000902',
        externalFeedbackUuid: '00000000-0000-4000-8000-000000000903',
        placeSlug: 'PetHouse',
        reviewerName: 'Google Reviewer',
        rating: 5,
      }),
    ).resolves.toBeUndefined();

    expect(String(query.mock.calls[0]?.[0])).toContain('INSERT INTO feedback_timeline_events');
    expect(query.mock.calls[0]?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000903',
      'review_received',
      JSON.stringify({
        reviewUuid: '00000000-0000-4000-8000-000000000902',
        placeSlug: 'PetHouse',
      }),
    ]);
    expect(String(query.mock.calls[1]?.[0])).toContain("e.staff_role = 'manager'");
    expect(String(query.mock.calls[1]?.[0])).toContain("e.staff_status = 'active'");
    expect(String(query.mock.calls[2]?.[0])).toContain('INSERT INTO notification');
    expect(query.mock.calls[2]?.[1]).toEqual([
      'google_review_created',
      'google_review',
      'New review from Google Reviewer: 5 stars · PetHouse',
      '00000000-0000-4000-8000-000000000901',
      ['00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202'],
    ]);
  });

  it('still records the receipt event when no active manager is configured', async () => {
    const client = createClient();
    const query = vi.mocked(client.query);
    query
      .mockResolvedValueOnce({ rows: [{ uuid: '00000000-0000-4000-8000-000000000901' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      insertGoogleReviewReceiptNotifications(client, {
        reviewUuid: '00000000-0000-4000-8000-000000000902',
        externalFeedbackUuid: '00000000-0000-4000-8000-000000000903',
        placeSlug: 'PetHouse',
        reviewerName: 'Google Reviewer',
        rating: 4,
      }),
    ).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledTimes(2);
  });

  it('deletes notification rows linked to a Google Review before review deletion', async () => {
    const client = createClient();

    await expect(
      deleteGoogleReviewNotifications(client, '00000000-0000-4000-8000-000000000902'),
    ).resolves.toBeUndefined();

    expect(String(vi.mocked(client.query).mock.calls[0]?.[0])).toContain(
      'DELETE FROM notification',
    );
    expect(vi.mocked(client.query).mock.calls[0]?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000902',
    ]);
  });
});

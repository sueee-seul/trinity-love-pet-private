import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { findGoogleReviewDashboardRecords } from '../repositories/admin.google.review.dashboard.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

describe('admin Google review dashboard repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('loads PetHouse dashboard inputs without source-deleted reviews or unsuccessful replies', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'location-1',
            display_name: 'PetHouse',
            data_origin: 'mock',
            last_observed_at: new Date('2026-09-03T00:00:00.000Z'),
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'review-1',
            rating: 4,
            review_text: 'A review comment.',
            google_created_at: new Date('2026-09-02T00:00:00.000Z'),
            investigation_result: null,
            manager_correction: null,
            latest_successful_reply_at: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            review_id: 'review-2',
            sent_at: new Date('2026-09-02T01:00:00.000Z'),
          },
        ],
      } as never);

    await expect(findGoogleReviewDashboardRecords('PetHouse')).resolves.toEqual({
      location: {
        id: 'location-1',
        display_name: 'PetHouse',
        data_origin: 'mock',
        last_observed_at: new Date('2026-09-03T00:00:00.000Z'),
      },
      reviews: [
        {
          id: 'review-1',
          rating: 4,
          review_text: 'A review comment.',
          google_created_at: new Date('2026-09-02T00:00:00.000Z'),
          investigation_result: null,
          manager_correction: null,
          latest_successful_reply_at: null,
        },
      ],
      replyEvents: [
        {
          review_id: 'review-2',
          sent_at: new Date('2026-09-02T01:00:00.000Z'),
        },
      ],
    });

    const calls = vi.mocked(pool.query).mock.calls;
    expect(calls).toHaveLength(3);
    expect(String(calls[0]?.[0])).toContain('FROM google_business_locations');
    expect(calls[0]?.[1]).toEqual(['mock-pethouse-location']);
    expect(String(calls[1]?.[0])).toContain('review.source_deleted_at IS NULL');
    expect(String(calls[1]?.[0])).toContain("reply.reply_status = 'sent'");
    expect(String(calls[1]?.[0])).toContain("event.step = 'manager_correction'");
    expect(String(calls[1]?.[0])).not.toContain('investigation_result');
    expect(String(calls[1]?.[0])).toContain('review.comment AS review_text');
    expect(String(calls[1]?.[0])).not.toContain('external.ai_insights');
    expect(String(calls[1]?.[0])).toContain('reply.sent_at IS NOT NULL');
    expect(calls[1]?.[1]).toEqual(['location-1']);
    expect(String(calls[2]?.[0])).toContain('JOIN external_feedback_replies reply');
    expect(String(calls[2]?.[0])).toContain("reply.reply_status = 'sent'");
    expect(calls[2]?.[1]).toEqual(['location-1']);
  });

  it('does not query PostgreSQL for an unsupported place slug', async () => {
    await expect(findGoogleReviewDashboardRecords('UnknownPlace')).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns null when the PetHouse location is not present', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(findGoogleReviewDashboardRecords('PetHouse')).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledOnce();
  });
});

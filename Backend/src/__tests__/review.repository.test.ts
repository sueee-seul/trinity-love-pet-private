import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  createGoogleBusinessReviewRecord,
  createReviewRecord,
  deleteMockGoogleBusinessReviewRecord,
  findGoogleBusinessReviewPage,
} from '../repositories/review.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));

describe('review repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.connect).mockReset();
  });

  it('loads the PetHouse location and Google-shaped reviews for the review page', async () => {
    const createdAt = new Date('2026-09-01T00:00:00.000Z');
    const updatedAt = new Date('2026-09-01T00:00:00.000Z');
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000401',
            display_name: 'PetHouse',
            formatted_address: '18 PetHouse Lane, Grey Lynn, Auckland 1021',
            google_maps_uri: null,
            aggregate_rating: null,
            user_rating_count: 0,
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000902',
            reviewer_display_name: 'Google Reviewer',
            reviewer_profile_photo_url: null,
            reviewer_is_anonymous: false,
            rating: 5,
            comment: 'Great care.',
            google_created_at: createdAt,
            google_updated_at: updatedAt,
            owner_reply: 'The latest sent reply',
            owner_reply_updated_at: new Date('2026-09-02T01:00:00.000Z'),
            photo_urls: ['/uploads/google-reviews/cat.jpg'],
          },
        ],
      } as never);
    await expect(findGoogleBusinessReviewPage('PetHouse')).resolves.toEqual({
      location: {
        id: '00000000-0000-4000-8000-000000000401',
        display_name: 'PetHouse',
        formatted_address: '18 PetHouse Lane, Grey Lynn, Auckland 1021',
        google_maps_uri: null,
        aggregate_rating: null,
        user_rating_count: 0,
      },
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000000902',
          reviewer_display_name: 'Google Reviewer',
          reviewer_profile_photo_url: null,
          reviewer_is_anonymous: false,
          rating: 5,
          comment: 'Great care.',
          google_created_at: createdAt,
          google_updated_at: updatedAt,
          owner_reply: 'The latest sent reply',
          owner_reply_updated_at: new Date('2026-09-02T01:00:00.000Z'),
          photo_urls: ['/uploads/google-reviews/cat.jpg'],
        },
      ],
    });

    const [locationQuery, locationValues] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const [reviewQuery, reviewValues] = vi.mocked(pool.query).mock.calls[1] ?? [];
    expect(String(locationQuery)).toContain('FROM google_business_locations');
    expect(locationValues).toEqual(['mock-pethouse-location']);
    expect(String(reviewQuery)).toContain('FROM google_business_reviews');
    expect(String(reviewQuery)).toContain('FROM external_feedback_replies reply');
    expect(String(reviewQuery)).toContain("reply.reply_status = 'sent'");
    expect(String(reviewQuery)).toContain('ORDER BY reply.created_at DESC');
    expect(reviewValues).toEqual(['00000000-0000-4000-8000-000000000401', null]);
  });

  it('persists a human review without queuing investigation work', async () => {
    const createdAt = new Date('2026-08-31T00:00:00.000Z');
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000401' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000902',
            reviewer_id: '00000000-0000-4000-8000-000000000901',
            place_slug: 'PetHouse',
            rating: 5,
            review_text: 'Great care.',
            source: 'human',
            service_user_match_status: 'pending',
            created_at: createdAt,
          },
        ],
      } as never);
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000902',
            reviewer_id: '00000000-0000-4000-8000-000000000901',
            place_slug: 'PetHouse',
            rating: 5,
            review_text: 'Great care.',
            source: 'human',
            service_user_match_status: 'pending',
            created_at: createdAt,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000903' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createGoogleBusinessReviewRecord({
        reviewerId: '00000000-0000-4000-8000-000000000901',
        reviewerDisplayName: 'Google Reviewer',
        reviewerAvatarUrl: 'https://example.test/avatar.png',
        placeSlug: 'PetHouse',
        rating: 5,
        reviewText: 'Great care.',
        photoUrls: ['/uploads/google-reviews/cat.jpg', '/uploads/google-reviews/cat-second.jpg'],
      }),
    ).resolves.toMatchObject({ id: '00000000-0000-4000-8000-000000000902' });

    const [locationQuery, locationValues] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const [reviewQuery, reviewValues] = client.query.mock.calls[1] ?? [];
    expect(String(locationQuery)).toContain('FROM google_business_locations');
    expect(locationValues).toEqual(['mock-pethouse-location']);
    expect(String(reviewQuery)).toContain('INSERT INTO google_business_reviews');
    expect(String(reviewQuery)).not.toContain('INSERT INTO place_reviews');
    expect(String(client.query.mock.calls[2]?.[0])).toContain(
      'INSERT INTO google_review_media_logs',
    );
    expect(client.query.mock.calls[2]?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000902',
      '/uploads/google-reviews/cat.jpg',
      expect.any(Date),
    ]);
    expect(client.query.mock.calls[3]?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000902',
      '/uploads/google-reviews/cat-second.jpg',
      expect.any(Date),
    ]);
    expect(client.query.mock.calls[2]?.[1]?.[2]).not.toEqual(client.query.mock.calls[3]?.[1]?.[2]);
    expect(String(client.query.mock.calls[4]?.[0])).toContain('INSERT INTO external_feedback');
    expect(String(client.query.mock.calls[4]?.[0])).not.toContain('ai_insights');
    expect(client.query.mock.calls[4]?.[1]).toEqual(['00000000-0000-4000-8000-000000000902']);
    expect(client.query.mock.calls[5]?.[0]).toBe('COMMIT');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('investigation_requested')),
    ).toBe(false);
    expect(reviewValues).toEqual([
      '00000000-0000-4000-8000-000000000401',
      expect.stringMatching(/^mock-pethouse-review-/),
      expect.stringMatching(
        /^accounts\/mock-pethouse-account\/locations\/mock-pethouse-location\/reviews\/mock-pethouse-review-/,
      ),
      'Google Reviewer',
      'https://example.test/avatar.png',
      5,
      'Great care.',
      '00000000-0000-4000-8000-000000000901',
      'PetHouse',
    ]);
  });

  it('writes one manager receipt notification when human notification is enabled', async () => {
    const createdAt = new Date('2026-08-31T00:00:00.000Z');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ uuid: '00000000-0000-4000-8000-000000000401' }],
    } as never);
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000902',
            reviewer_id: '00000000-0000-4000-8000-000000000901',
            place_slug: 'PetHouse',
            rating: 5,
            review_text: 'Great care.',
            source: 'human',
            service_user_match_status: 'pending',
            created_at: createdAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000903' }],
      })
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000904' }],
      })
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000201' }],
      })
      .mockResolvedValueOnce({ rows: [{ uuid: '00000000-0000-4000-8000-000000000911' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createGoogleBusinessReviewRecord({
        reviewerId: '00000000-0000-4000-8000-000000000901',
        reviewerDisplayName: 'Google Reviewer',
        reviewerAvatarUrl: null,
        placeSlug: 'PetHouse',
        rating: 5,
        reviewText: 'Great care.',
        photoUrls: [],
        notifyActiveManagers: true,
      }),
    ).resolves.toMatchObject({ id: '00000000-0000-4000-8000-000000000902' });

    const queryStrings = client.query.mock.calls.map(([query]) => String(query));
    expect(queryStrings).toContain('BEGIN');
    expect(queryStrings).toContain('COMMIT');
    expect(queryStrings.some((query) => query.includes('INSERT INTO notification'))).toBe(true);
    const notificationCall = client.query.mock.calls.find(([query]) =>
      String(query).includes('INSERT INTO notification'),
    );
    expect(notificationCall?.[1]).toEqual([
      'google_review_created',
      'google_review',
      'New review from Google Reviewer: 5 stars · PetHouse',
      '00000000-0000-4000-8000-000000000904',
      ['00000000-0000-4000-8000-000000000201'],
    ]);
  });

  it('persists a review in the dedicated place_reviews table with a server-owned pending status', async () => {
    const createdAt = new Date('2026-08-31T00:00:00.000Z');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-4000-8000-000000000902',
          reviewer_id: '00000000-0000-4000-8000-000000000901',
          place_slug: 'boarding_title',
          rating: 5,
          review_text: 'Great care.',
          source: 'human',
          service_user_match_status: 'pending',
          created_at: createdAt,
        },
      ],
    } as never);

    await expect(
      createReviewRecord({
        reviewerId: '00000000-0000-4000-8000-000000000901',
        placeSlug: 'boarding_title',
        rating: 5,
        reviewText: 'Great care.',
        source: 'human',
      }),
    ).resolves.toMatchObject({
      source: 'human',
      service_user_match_status: 'pending',
    });

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('INSERT INTO place_reviews');
    expect(String(query)).toContain("'pending'");
    expect(String(query)).not.toContain('INSERT INTO feedback');
    expect(values).toEqual([
      '00000000-0000-4000-8000-000000000901',
      'boarding_title',
      5,
      'Great care.',
      'human',
    ]);
  });

  it('persists simulator input in Google review tables without AI insights', async () => {
    const createdAt = new Date('2026-08-31T00:00:00.000Z');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ uuid: '00000000-0000-0000-0000-000000000401' }],
    } as never);
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000902',
            reviewer_id: '00000000-0000-4000-8000-000000000901',
            place_slug: 'PetHouse',
            rating: 4,
            review_text: 'Good care.',
            source: 'human',
            service_user_match_status: 'pending',
            created_at: createdAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000903' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createGoogleBusinessReviewRecord({
        reviewerId: '00000000-0000-4000-8000-000000000901',
        reviewerDisplayName: 'Fixture Reviewer',
        reviewerAvatarUrl: null,
        placeSlug: 'PetHouse',
        rating: 4,
        reviewText: 'Good care.',
        photoUrls: [],
      }),
    ).resolves.toMatchObject({ id: '00000000-0000-4000-8000-000000000902' });

    const queries = client.query.mock.calls.map(([query]) => String(query));
    expect(queries).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO google_business_reviews'),
      expect.stringContaining('INSERT INTO external_feedback'),
      'COMMIT',
    ]);
    expect(queries.some((query) => query.includes('INSERT INTO place_reviews'))).toBe(false);
    expect(client.query.mock.calls[2]?.[1]).toEqual(['00000000-0000-4000-8000-000000000902']);
  });

  it('fails when the insert does not return a review', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      createReviewRecord({
        reviewerId: '00000000-0000-4000-8000-000000000901',
        placeSlug: 'boarding_title',
        rating: 1,
        reviewText: null,
        source: 'simulator',
      }),
    ).rejects.toThrow('Review insert returned no review');
  });

  it('deletes dependencies before a mock review in one transaction', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uuid: 'review-1' }] })
      .mockResolvedValueOnce({ rows: [{ photo_urls: ['/uploads/google-reviews/a.jpg'] }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uuid: 'review-1' }] });

    await expect(deleteMockGoogleBusinessReviewRecord('review-1')).resolves.toEqual({
      photoUrls: ['/uploads/google-reviews/a.jpg'],
    });
    expect(client.query.mock.calls.map(([query]) => String(query))).toEqual([
      'BEGIN',
      expect.stringContaining('FROM google_business_reviews'),
      expect.stringContaining('google_review_media_logs'),
      expect.stringContaining('DELETE FROM notification'),
      expect.stringContaining('DELETE FROM external_feedback'),
      expect.stringContaining('DELETE FROM google_business_reviews'),
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not delete a live review', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(deleteMockGoogleBusinessReviewRecord('live-review')).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('external_feedback')),
    ).toBe(false);
  });
});

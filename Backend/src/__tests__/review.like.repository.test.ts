import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { setGoogleReviewLike } from '../repositories/review.like.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));

const REVIEW_ID = '00000000-0000-4000-8000-000000000902';
const REVIEWER_ID = '00000000-0000-4000-8000-000000000901';

describe('review like repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.connect).mockReset();
  });

  const mockClient = (): { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    return client;
  };

  it('stores a like and returns the count that already includes it', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ uuid: REVIEW_ID }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ like_count: 3, viewer_has_liked: true }] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await setGoogleReviewLike({
      reviewId: REVIEW_ID,
      reviewerId: REVIEWER_ID,
      liked: true,
    });

    expect(result).toEqual({ reviewId: REVIEW_ID, likeCount: 3, viewerHasLiked: true });
    expect(client.query.mock.calls[2]?.[0]).toContain('INSERT INTO google_review_likes');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('keeps a repeated like from counting twice', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uuid: REVIEW_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ like_count: 1, viewer_has_liked: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await setGoogleReviewLike({
      reviewId: REVIEW_ID,
      reviewerId: REVIEWER_ID,
      liked: true,
    });

    expect(result?.likeCount).toBe(1);
    expect(client.query.mock.calls[2]?.[0]).toContain(
      'ON CONFLICT (google_business_review_uuid, reviewer_uuid) DO NOTHING',
    );
  });

  it('removes the like row when the reviewer unlikes', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uuid: REVIEW_ID }] })
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ like_count: 2, viewer_has_liked: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await setGoogleReviewLike({
      reviewId: REVIEW_ID,
      reviewerId: REVIEWER_ID,
      liked: false,
    });

    expect(result).toEqual({ reviewId: REVIEW_ID, likeCount: 2, viewerHasLiked: false });
    expect(client.query.mock.calls[2]?.[0]).toContain('DELETE FROM google_review_likes');
  });

  it('rolls back and reports no state when the review does not exist', async () => {
    const client = mockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }) // review lookup finds nothing
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const result = await setGoogleReviewLike({
      reviewId: REVIEW_ID,
      reviewerId: REVIEWER_ID,
      liked: true,
    });

    expect(result).toBeNull();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO google_review_likes'),
      expect.anything(),
    );
  });
});

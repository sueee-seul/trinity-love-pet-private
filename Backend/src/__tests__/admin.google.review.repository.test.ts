import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  assignGoogleReviewRecords,
  findAdminGoogleBusinessReviews,
  updateGoogleReviewTriage,
  updateMockGoogleBusinessReviewReply,
} from '../repositories/admin.google.review.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));

describe('admin Google review repository', () => {
  const manager = { id: '00000000-0000-4000-8000-000000000201', role: 'manager' as const };
  const staff = { id: '00000000-0000-4000-8000-000000000202', role: 'staff' as const };
  const reviewUuid = '00000000-0000-4000-8000-000000000901';
  const managerCorrection = {
    correctionId: '00000000-0000-4000-8000-000000000903',
    reviewUuid,
    sourceRunId: null,
    originalAiType: null,
    correctedType: 'praise' as const,
    managerId: manager.id,
    occurredAt: '2026-09-02T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.connect).mockReset();
  });

  it('uses all review rows for managers and the assigned employee predicate for staff', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ uuid: 'location-1' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ uuid: 'location-1' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(findAdminGoogleBusinessReviews('PetHouse', manager)).resolves.toEqual([]);
    await expect(findAdminGoogleBusinessReviews('PetHouse', staff)).resolves.toEqual([]);

    const managerLocationValues = vi.mocked(pool.query).mock.calls[0]?.[1];
    const managerQuery = String(vi.mocked(pool.query).mock.calls[1]?.[0]);
    const managerReviewValues = vi.mocked(pool.query).mock.calls[1]?.[1];
    const staffLocationValues = vi.mocked(pool.query).mock.calls[2]?.[1];
    const staffQuery = String(vi.mocked(pool.query).mock.calls[3]?.[0]);
    const staffReviewValues = vi.mocked(pool.query).mock.calls[3]?.[1];
    expect(managerQuery).not.toContain('external.assigned_employee_uuid = $2::uuid');
    expect(staffQuery).toContain('external.assigned_employee_uuid = $2::uuid');
    expect(managerLocationValues).toEqual(['mock-pethouse-location']);
    expect(managerReviewValues).toEqual(['location-1']);
    expect(staffLocationValues).toEqual(['mock-pethouse-location']);
    expect(staffReviewValues).toEqual(['location-1', staff.id]);
  });

  it('deduplicates and commits an atomic external assignment upsert', async () => {
    const reviewUuid = '00000000-0000-4000-8000-000000000901';
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ uuid: manager.id }] })
      .mockResolvedValueOnce({
        rows: [
          {
            uuid: reviewUuid,
            manager_correction: managerCorrection,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ uuid: reviewUuid }] });

    await expect(assignGoogleReviewRecords([reviewUuid, reviewUuid], manager.id)).resolves.toEqual({
      updatedUuids: [reviewUuid],
      missingUuids: [],
      invalidAssignee: false,
    });
    expect(String(client.query.mock.calls[3]?.[0])).toContain('INSERT INTO external_feedback');
    expect(String(client.query.mock.calls[3]?.[0])).toContain(
      'ON CONFLICT (google_business_review_uuid)',
    );
    expect(client.query.mock.calls[1]?.[1]).toEqual([manager.id]);
    expect(client.query.mock.calls[2]?.[1]).toEqual([[reviewUuid]]);
    expect(client.query.mock.calls.map(([query]) => String(query))).toContain('COMMIT');
    expect(client.query.mock.calls.map(([query]) => String(query))).not.toContain('ALTER TABLE');
  });

  it('rolls back without changing reviews when the assignee is not an employee', async () => {
    const reviewUuid = '00000000-0000-4000-8000-000000000901';
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(
      assignGoogleReviewRecords([reviewUuid], '00000000-0000-4000-8000-000000000299'),
    ).resolves.toEqual({
      updatedUuids: [],
      missingUuids: [],
      invalidAssignee: true,
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('external_feedback')),
    ).toBe(false);
  });

  it('rolls back all assignments when one selected review is missing', async () => {
    const existingUuid = '00000000-0000-4000-8000-000000000901';
    const missingUuid = '00000000-0000-4000-8000-000000000999';
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ uuid: manager.id }] })
      .mockResolvedValueOnce({
        rows: [
          {
            uuid: existingUuid,
            manager_correction: { ...managerCorrection, reviewUuid: existingUuid },
          },
        ],
      });

    await expect(
      assignGoogleReviewRecords([existingUuid, missingUuid], manager.id),
    ).resolves.toEqual({
      updatedUuids: [],
      missingUuids: [missingUuid],
      invalidAssignee: false,
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes('INSERT INTO external_feedback'),
      ),
    ).toBe(false);
  });

  it('rolls back all assignments when a selected review has no effective type', async () => {
    const reviewUuid = '00000000-0000-4000-8000-000000000901';
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ uuid: manager.id }] })
      .mockResolvedValueOnce({
        rows: [{ uuid: reviewUuid, manager_correction: null }],
      });

    await expect(assignGoogleReviewRecords([reviewUuid], manager.id)).resolves.toEqual({
      updatedUuids: [],
      missingUuids: [],
      invalidAssignee: false,
      undecidedUuids: [reviewUuid],
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes('INSERT INTO external_feedback'),
      ),
    ).toBe(false);
  });

  it('loads Google reviews without legacy investigation-result fields', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ uuid: 'location-1' }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: reviewUuid,
            reviewer_display_name: 'Andrew',
            reviewer_email: 'andrew@example.test',
            reviewer_profile_photo_url: null,
            reviewer_is_anonymous: false,
            rating: 5,
            comment: 'Great care.',
            google_created_at: new Date('2026-08-10T00:00:00.000Z'),
            google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
            owner_reply: 'Earlier sent reply',
            owner_reply_updated_at: new Date('2026-09-01T01:00:00.000Z'),
            photo_urls: [],
            is_read: false,
            current_status: 'received',
            assigned_employee_uuid: null,
            manager_correction: null,
          },
        ],
      } as never);

    await expect(findAdminGoogleBusinessReviews('PetHouse', manager)).resolves.toHaveLength(1);

    const [locationQuery, locationValues] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const [reviewQuery, reviewValues] = vi.mocked(pool.query).mock.calls[1] ?? [];
    expect(String(locationQuery)).toContain('FROM google_business_locations');
    expect(locationValues).toEqual(['mock-pethouse-location']);
    expect(String(reviewQuery)).toContain('LEFT JOIN external_feedback');
    expect(String(reviewQuery)).toContain('reviewer_identities');
    expect(String(reviewQuery)).toContain('review.comment');
    expect(String(reviewQuery)).toContain('external.is_read');
    expect(String(reviewQuery)).toContain('external.current_status');
    expect(String(reviewQuery)).toContain('external.assigned_employee_uuid');
    expect(String(reviewQuery)).not.toContain('investigation_result');
    expect(String(reviewQuery)).toContain('manager_correction');
    expect(String(reviewQuery)).not.toContain('external.ai_insights');
    expect(String(reviewQuery)).toContain('FROM external_feedback_replies reply');
    expect(String(reviewQuery)).toContain("reply.reply_status = 'sent'");
    expect(String(reviewQuery)).toContain('ORDER BY reply.created_at DESC');
    expect(reviewValues).toEqual(['location-1']);
  });

  it('updates a mock review reply and returns the updated admin projection atomically', async () => {
    const updatedReview = {
      id: 'review-1',
      reviewer_display_name: 'Andrew',
      reviewer_email: 'andrew@example.test',
      reviewer_profile_photo_url: null,
      reviewer_is_anonymous: false,
      rating: 5,
      comment: 'Great care.',
      google_created_at: new Date('2026-08-10T00:00:00.000Z'),
      google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
      owner_reply: 'Thank you for sharing this.',
      owner_reply_updated_at: new Date('2026-09-02T01:00:00.000Z'),
      photo_urls: [],
      is_read: true,
      current_status: 'review_started',
      assigned_employee_uuid: '00000000-0000-4000-8000-000000000202',
      manager_correction: null,
    };
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'review-1',
            data_origin: 'mock',
            reviewer_email: 'andrew@example.test',
            external_feedback_uuid: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ uuid: 'feedback-1' }] })
      .mockResolvedValueOnce({ rows: [{ uuid: 'reply-1' }] })
      .mockResolvedValueOnce({ rows: [updatedReview] });

    await expect(
      updateMockGoogleBusinessReviewReply('review-1', 'Thank you for sharing this.', manager),
    ).resolves.toEqual({ outcome: 'updated', review: updatedReview });

    const lockingQuery = String(client.query.mock.calls[1]?.[0]);
    expect(lockingQuery).toContain('FOR UPDATE OF review');
    expect(lockingQuery).not.toMatch(/FOR UPDATE\s*$/);
    expect(lockingQuery).toContain('reviewer_identities');
    expect(String(client.query.mock.calls[2]?.[0])).toContain(
      'INSERT INTO external_feedback (google_business_review_uuid)',
    );
    expect(client.query.mock.calls[2]?.[1]).toEqual(['review-1']);
    expect(String(client.query.mock.calls[3]?.[0])).toContain(
      'INSERT INTO external_feedback_replies',
    );
    expect(client.query.mock.calls[3]?.[1]).toEqual([
      'feedback-1',
      manager.id,
      'Thank you for sharing this.',
    ]);
    expect(String(client.query.mock.calls[4]?.[0])).toContain('LEFT JOIN external_feedback');
    expect(String(client.query.mock.calls[4]?.[0])).not.toContain('investigation_result');
    expect(String(client.query.mock.calls[4]?.[0])).toContain('manager_correction');
    expect(String(client.query.mock.calls[4]?.[0])).not.toContain('AS investigation_result');
    expect(String(client.query.mock.calls[4]?.[0])).toContain('AS manager_correction');
    expect(String(client.query.mock.calls[4]?.[0])).not.toContain(
      "event.step = 'investigation_result'",
    );
    expect(String(client.query.mock.calls[4]?.[0])).toContain("event.step = 'manager_correction'");
    expect(String(client.query.mock.calls[3]?.[0])).toContain("'sent'");
    expect(String(client.query.mock.calls[3]?.[0])).toContain('sent_at');
    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes('UPDATE google_business_reviews'),
      ),
    ).toBe(false);
    expect(client.query.mock.calls.map(([query]) => String(query))).toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns not-found for a staff reply outside the assigned scope', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(
      updateMockGoogleBusinessReviewReply('review-1', 'Thank you.', staff),
    ).resolves.toEqual({ outcome: 'not_found' });

    const lockingQuery = String(client.query.mock.calls[1]?.[0]);
    expect(lockingQuery).toContain('LEFT JOIN external_feedback');
    expect(lockingQuery).toContain('external.assigned_employee_uuid = $2::uuid');
    expect(client.query.mock.calls[1]?.[1]).toEqual(['review-1', staff.id]);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes('UPDATE google_business_reviews'),
      ),
    ).toBe(false);
  });

  it('rolls back when the reply insert fails without updating the Google review', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'review-1',
            data_origin: 'mock',
            reviewer_email: 'andrew@example.test',
            external_feedback_uuid: 'feedback-1',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('reply insert failed'));

    await expect(
      updateMockGoogleBusinessReviewReply('review-1', 'Thank you.', manager),
    ).rejects.toThrow('reply insert failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) =>
        String(query).includes('UPDATE google_business_reviews'),
      ),
    ).toBe(false);
  });

  it('rolls back when the mock review has no recipient email', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ id: 'review-1', data_origin: 'mock', reviewer_email: null }],
    });

    await expect(
      updateMockGoogleBusinessReviewReply('review-1', 'Thank you.', manager),
    ).resolves.toEqual({
      outcome: 'recipient_unavailable',
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).trimStart().startsWith('UPDATE')),
    ).toBe(false);
  });

  it('returns null when the place slug or location is not configured', async () => {
    await expect(findAdminGoogleBusinessReviews('UnknownPlace', manager)).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    await expect(findAdminGoogleBusinessReviews('PetHouse', manager)).resolves.toBeNull();
  });

  it('persists a manual review type without requiring an AI investigation result', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    const updatedReview = {
      id: reviewUuid,
      reviewer_display_name: 'Andrew',
      reviewer_email: 'andrew@example.test',
      reviewer_profile_photo_url: null,
      reviewer_is_anonymous: false,
      rating: 5,
      comment: 'Great care.',
      google_created_at: new Date('2026-08-10T00:00:00.000Z'),
      google_updated_at: new Date('2026-08-10T00:00:00.000Z'),
      owner_reply: null,
      owner_reply_updated_at: null,
      photo_urls: [],
      is_read: false,
      current_status: 'received',
      assigned_employee_uuid: null,
      manager_correction: {
        correctionId: '00000000-0000-4000-8000-000000000903',
        reviewUuid,
        sourceRunId: null,
        originalAiType: null,
        correctedType: 'issue',
        managerId: manager.id,
        occurredAt: '2026-09-02T00:00:00.000Z',
      },
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: reviewUuid,
            external_feedback_uuid: 'feedback-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ uuid: '00000000-0000-4000-8000-000000000906' }] })
      .mockResolvedValueOnce({ rows: [updatedReview] });

    await expect(updateGoogleReviewTriage(reviewUuid, 'issue', manager.id)).resolves.toMatchObject({
      outcome: 'updated',
      review: updatedReview,
    });
    const updateQuery = String(client.query.mock.calls[2]?.[0]);
    expect(updateQuery).toContain('INSERT INTO feedback_timeline_events');
    expect(updateQuery).toContain("'manager_correction'");
    expect(client.query.mock.calls[2]?.[1]?.[0]).toBe('feedback-1');
    expect(JSON.parse(String(client.query.mock.calls[2]?.[1]?.[1]))).toMatchObject({
      reviewUuid,
      sourceRunId: null,
      originalAiType: null,
      correctedType: 'issue',
      managerId: manager.id,
    });
    expect(client.query.mock.calls.map(([query]) => String(query))).toContain('COMMIT');
  });

  it('rolls back type updates for missing or invalid review data', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(updateGoogleReviewTriage('missing-review', 'praise', manager.id)).resolves.toEqual(
      {
        outcome: 'not_found',
      },
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');

    vi.mocked(pool.connect).mockResolvedValueOnce(client as never);
    client.query.mockReset();
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ id: reviewUuid, external_feedback_uuid: null }],
    });
    await expect(updateGoogleReviewTriage(reviewUuid, 'praise', manager.id)).resolves.toEqual({
      outcome: 'invalid_data',
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

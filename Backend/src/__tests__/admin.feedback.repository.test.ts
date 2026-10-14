import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  deleteFeedbackRecord,
  getAdminFeedbackRecord,
  listEmployeeStaffOptions,
  listAdminFeedbackDetailRecords,
  transitionIssueFeedback,
  transitionSuggestionFeedback,
  listAdminFeedbackRecords,
  assignFeedbackRecords,
  markFeedbackRecordsAsRead,
} from '../repositories/admin.feedback.repository.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

const feedbackRow = {
  uuid: '00000000-0000-4000-8000-000000000b11',
  parent_name: 'Ava Mitchell',
  pet_name: 'Biscuit',
  created_at: new Date('2026-08-15T00:00:00.000Z'),
  category: 'Praise' as const,
  is_read: false,
  current_status: 'submitted' as const,
  rating: 4.2,
  ai_summary: 'A clear summary.',
};

describe('admin feedback repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.connect).mockReset();
  });

  it('loads staff options from employee UUIDs instead of dummy auth identifiers', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ id: '00000000-0000-4000-8000-000000000201', name: 'olivia.care' }],
      rowCount: 1,
    } as never);

    const result = await listEmployeeStaffOptions();

    expect(result).toEqual([{ id: '00000000-0000-4000-8000-000000000201', name: 'olivia.care' }]);
    const [query] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('JOIN employees e ON e.users_uuid = u.uuid');
    expect(String(query)).toContain('u.is_employee = TRUE');
  });

  it('binds Suggestion statuses at $1 when the list has no filter parameters', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [feedbackRow], rowCount: 1 } as never);

    const result = await listAdminFeedbackRecords({
      status: 'all',
      sort: 'newest',
      timeRange: 'all',
      rating: 'all',
    });

    expect(result).toEqual([feedbackRow]);
    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('suggestion_event.step = ANY($1::varchar[])');
    expect(values).toEqual([['captured', 'under_review', 'decision_recorded', 'closed']]);
  });

  it('builds a joined DB query with search, category, unread status, and rating sort', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [feedbackRow], rowCount: 1 } as never);

    const result = await listAdminFeedbackRecords({
      search: 'Ava',
      category: 'Issue',
      status: 'unread',
      sort: 'highest',
      timeRange: 'custom',
      rating: 'medium',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    expect(result).toEqual([feedbackRow]);
    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const sql = String(query);

    expect(sql).toContain('JOIN pets p ON p.uuid = f.pet_uuid');
    expect(sql).toContain('JOIN pet_owners po ON po.users_uuid = f.pet_owners_uuid');
    expect(sql).toContain("assignment_event.step = 'assigned'");
    expect(sql).toContain('ILIKE $1');
    expect(sql).toContain('f.category = $2');
    expect(sql).toContain('f.is_read = false');
    expect(sql).toContain("COALESCE(f.raw_answer, '') ILIKE $1");
    expect(sql).toContain("COALESCE(f.ai_insights ->> 'summary', '') ILIKE $1");
    expect(sql).toContain("f.created_at >= ($3::date AT TIME ZONE 'Pacific/Auckland')");
    expect(sql).toContain(
      "f.created_at < (($4::date + INTERVAL '1 day') AT TIME ZONE 'Pacific/Auckland')",
    );
    expect(sql).toContain('f.rating > 2 AND f.rating < 4');
    expect(sql).toContain('ORDER BY f.rating DESC');
    expect(values).toEqual([
      '%Ava%',
      'Issue',
      '2026-08-01',
      '2026-08-31',
      ['captured', 'under_review', 'decision_recorded', 'closed'],
    ]);
    expect(sql).toContain('suggestion_event.step = ANY($5::varchar[])');
  });

  it('uses numeric rating bounds and keeps Suggestion statuses after range values', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [feedbackRow], rowCount: 1 } as never);

    const result = await listAdminFeedbackRecords({
      status: 'all',
      sort: 'newest',
      timeRange: 'all',
      rating: 'all',
      ratingMin: 3.25,
      ratingMax: 4.75,
    });

    expect(result).toEqual([feedbackRow]);
    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const sql = String(query);
    expect(sql).toContain('f.rating >= $1');
    expect(sql).toContain('f.rating <= $2');
    expect(sql).toContain('suggestion_event.step = ANY($3::varchar[])');
    expect(values).toEqual([
      3.25,
      4.75,
      ['captured', 'under_review', 'decision_recorded', 'closed'],
    ]);
    expect(sql).not.toContain('f.rating > 2 AND f.rating < 4');
  });

  it('preserves legacy preset rating predicates when no numeric range is provided', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [feedbackRow], rowCount: 1 } as never);

    await listAdminFeedbackRecords({
      status: 'all',
      sort: 'newest',
      timeRange: 'all',
      rating: 'high',
    });

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const sql = String(query);
    expect(sql).toContain('f.rating >= 4');
    expect(sql).toContain('suggestion_event.step = ANY($1::varchar[])');
    expect(values).toEqual([['captured', 'under_review', 'decision_recorded', 'closed']]);
  });

  it('adds a database-relative window for the last seven days', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);

    await listAdminFeedbackRecords({
      status: 'all',
      sort: 'newest',
      timeRange: 'last_7_days',
      rating: 'all',
    });

    const [query] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain("f.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'");
  });

  it('loads detail fields and timeline events from the database', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          ...feedbackRow,
          rating_details: {
            Professional: 5,
            Service: 4,
            Communication: 3,
            Safety: 4,
            Cost: 4,
          },
          raw_answer: 'The parent answer.',
          transcript: null,
          audio_url: null,
          ai_insights: { summary: 'Summary', insights: ['Insight'] },
          timeline: [
            {
              step: 'submitted',
              created_at: '2026-08-15T00:00:00.000Z',
              actor: 'System',
              event_payload: {},
            },
          ],
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getAdminFeedbackRecord(feedbackRow.uuid);

    expect(result?.raw_answer).toBe('The parent answer.');
    expect(result?.timeline[0]?.step).toBe('submitted');
    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('json_agg');
    expect(String(query)).toContain('feedback_timeline_events timeline');
    expect(String(query)).toContain('WHERE f.uuid = $1::uuid');
    expect(values).toEqual([feedbackRow.uuid]);
  });

  it('reads event_payload and actorId from persisted timeline events', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          ...feedbackRow,
          rating_details: {},
          raw_answer: null,
          transcript: null,
          audio_url: null,
          ai_insights: null,
          timeline: [
            {
              step: 'review_started',
              created_at: '2026-08-15T00:00:00.000Z',
              actor: 'staff-999',
              event_payload: { actorId: 'staff-999' },
            },
          ],
        },
      ],
      rowCount: 1,
    } as never);

    const result = await getAdminFeedbackRecord(feedbackRow.uuid);

    expect(result?.timeline[0]).toEqual({
      step: 'review_started',
      created_at: '2026-08-15T00:00:00.000Z',
      actor: 'staff-999',
      event_payload: { actorId: 'staff-999' },
    });
    expect(String(vi.mocked(pool.query).mock.calls[0]?.[0])).toContain(
      "timeline.event_payload ->> 'actorId'",
    );
    expect(String(vi.mocked(pool.query).mock.calls[0]?.[0])).toContain(
      "'event_payload', COALESCE(timeline.event_payload, '{}'::jsonb)",
    );
  });

  it('loads the complete feedback snapshot without a UUID filter', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          ...feedbackRow,
          rating_details: {
            Professional: 5,
            Service: 4,
            Communication: 3,
            Safety: 4,
            Cost: 4,
          },
          raw_answer: 'The parent answer.',
          transcript: null,
          audio_url: null,
          ai_insights: { summary: 'Summary', insights: ['Insight'] },
          timeline: [
            {
              step: 'submitted',
              created_at: '2026-08-15T00:00:00.000Z',
              actor: 'System',
              event_payload: {},
            },
          ],
        },
      ],
      rowCount: 1,
    } as never);

    const result = await listAdminFeedbackDetailRecords();

    expect(result).toHaveLength(1);
    expect(result[0]?.raw_answer).toBe('The parent answer.');
    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    const sql = String(query);
    expect(sql).toContain('json_agg');
    expect(sql).toContain('AS assignee_uuid');
    expect(sql).toContain('ORDER BY f.created_at DESC, f.uuid DESC');
    expect(sql).not.toContain('WHERE f.uuid = $1::uuid');
    expect(values).toBeUndefined();
  });

  it('updates Issue status and inserts its timeline event in one transaction', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ category: 'Issue', current_status: 'submitted' }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await transitionIssueFeedback(
      feedbackRow.uuid,
      'review_started',
      'staff-999',
      'submitted',
    );

    expect(result).toEqual({ outcome: 'updated' });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(String(client.query.mock.calls[2]?.[0])).toContain('UPDATE feedback');
    expect(String(client.query.mock.calls[3]?.[0])).toContain(
      'INSERT INTO feedback_timeline_events',
    );
    expect(client.query.mock.calls[3]?.[1]).toEqual([
      feedbackRow.uuid,
      'review_started',
      JSON.stringify({ actorId: 'staff-999' }),
    ]);
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back an Issue transition when the persisted status is not the expected previous step', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ category: 'Issue', current_status: 'fact_checked' }],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await transitionIssueFeedback(
      feedbackRow.uuid,
      'review_started',
      'staff-999',
      'submitted',
    );

    expect(result).toEqual({ outcome: 'invalid_transition', currentStatus: 'fact_checked' });
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('UPDATE feedback')),
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('persists Suggestion workflow payloads without changing feedback.current_status', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ category: 'Suggestion' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              step: 'captured',
              event_payload: { ownerId: 'u1', decision: null },
            },
          ],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const payload = {
      workflow_type: 'suggestion',
      ownerId: 'u1',
      decision: null,
      evidenceSummary: null,
      decisionReason: null,
      nextReviewAt: null,
    };
    const result = await transitionSuggestionFeedback(
      feedbackRow.uuid,
      'under_review',
      'staff-999',
      'captured',
      payload,
    );

    expect(result).toEqual({ outcome: 'updated' });
    expect(String(client.query.mock.calls[3]?.[0])).toContain(
      'INSERT INTO feedback_timeline_events',
    );
    expect(client.query.mock.calls[3]?.[1]).toEqual([
      feedbackRow.uuid,
      'under_review',
      JSON.stringify({ ...payload, actorId: 'staff-999' }),
    ]);
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
  });

  it('updates all requested feedback rows in one transaction', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [
            { uuid: '00000000-0000-4000-8000-000000000b11' },
            { uuid: '00000000-0000-4000-8000-000000000b12' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { uuid: '00000000-0000-4000-8000-000000000b11' },
            { uuid: '00000000-0000-4000-8000-000000000b12' },
          ],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await markFeedbackRecordsAsRead([
      '00000000-0000-4000-8000-000000000b11',
      '00000000-0000-4000-8000-000000000b11',
      '00000000-0000-4000-8000-000000000b12',
    ]);

    expect(result).toEqual({
      updatedUuids: [
        '00000000-0000-4000-8000-000000000b11',
        '00000000-0000-4000-8000-000000000b12',
      ],
      missingUuids: [],
    });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(String(client.query.mock.calls[2]?.[0])).toContain('UPDATE feedback');
    expect(String(client.query.mock.calls[2]?.[0])).toContain('updated_at = now()');
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back without updating when one requested UUID is missing', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ uuid: '00000000-0000-4000-8000-000000000b11' }],
        })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await markFeedbackRecordsAsRead([
      '00000000-0000-4000-8000-000000000b11',
      '00000000-0000-4000-8000-000000000b12',
    ]);

    expect(result).toEqual({
      updatedUuids: [],
      missingUuids: ['00000000-0000-4000-8000-000000000b12'],
    });
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('UPDATE feedback')),
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('upserts one assigned timeline event for all selected feedbacks', async () => {
    const feedbackUuids = [
      '00000000-0000-4000-8000-000000000b11',
      '00000000-0000-4000-8000-000000000b12',
    ];
    const assigneeUuid = '00000000-0000-4000-8000-000000000201';
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ uuid: assigneeUuid }] })
        .mockResolvedValueOnce({ rows: feedbackUuids.map((uuid) => ({ uuid })) })
        .mockResolvedValueOnce({ rows: feedbackUuids.map((uuid) => ({ uuid })) })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await assignFeedbackRecords(feedbackUuids, assigneeUuid);

    expect(result).toEqual({
      updatedUuids: feedbackUuids,
      missingUuids: [],
      invalidAssignee: false,
    });
    expect(String(client.query.mock.calls[4]?.[0])).toContain(
      'INSERT INTO feedback_timeline_events',
    );
    expect(String(client.query.mock.calls[4]?.[0])).toContain('ON CONFLICT (feedback_uuid, step)');
    expect(client.query.mock.calls[4]?.[1]).toEqual([feedbackUuids, assigneeUuid]);
    expect(client.query).toHaveBeenNthCalledWith(6, 'COMMIT');
  });

  it('rolls back an assignment when the employee UUID is not valid', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await assignFeedbackRecords(
      ['00000000-0000-4000-8000-000000000b11'],
      '00000000-0000-4000-8000-000000000299',
    );

    expect(result).toEqual({ updatedUuids: [], missingUuids: [], invalidAssignee: true });
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('deletes feedback-linked notifications and the feedback row in one transaction', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ uuid: feedbackRow.uuid }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ uuid: feedbackRow.uuid }] })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await deleteFeedbackRecord(feedbackRow.uuid);

    expect(result).toEqual({ deletedUuid: feedbackRow.uuid });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(String(client.query.mock.calls[2]?.[0])).toContain(
      'DELETE FROM notification WHERE feedback_uuid = $1::uuid',
    );
    expect(client.query.mock.calls[2]?.[1]).toEqual([feedbackRow.uuid]);
    expect(String(client.query.mock.calls[3]?.[0])).toContain('DELETE FROM feedback');
    expect(client.query.mock.calls[3]?.[1]).toEqual([feedbackRow.uuid]);
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back without deleting when the feedback row does not exist', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const result = await deleteFeedbackRecord(feedbackRow.uuid);

    expect(result).toEqual({ deletedUuid: null });
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(
      client.query.mock.calls.some(([query]) => String(query).includes('DELETE FROM notification')),
    ).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back when deleting linked notifications fails', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ uuid: feedbackRow.uuid }] })
        .mockRejectedValueOnce(new Error('notification deletion failed')),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    await expect(deleteFeedbackRecord(feedbackRow.uuid)).rejects.toThrow(
      'notification deletion failed',
    );

    expect(client.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

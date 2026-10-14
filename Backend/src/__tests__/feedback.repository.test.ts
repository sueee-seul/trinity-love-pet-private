import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  createFeedbackRecord,
  findOwnedPetFeedbackContext,
} from '../repositories/feedback.repository.js';

vi.mock('../config/database.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const ratingDetails = {
  Professional: 5,
  Service: 4,
  Communication: 3,
  Safety: 4,
  Cost: 4,
};

describe('createFeedbackRecord', () => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(pool.connect).mockReset();
    vi.mocked(pool.query).mockReset();
    client.query.mockReset();
    client.release.mockReset();
    vi.mocked(pool.connect).mockResolvedValue(client as never);
  });

  it('finds the parent and pet context only for an owned pet', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ parent_name: 'Ava Mitchell', pet_name: 'Biscuit' }],
    } as never);

    await expect(
      findOwnedPetFeedbackContext(
        '00000000-0000-4000-8000-000000000501',
        '00000000-0000-4000-8000-000000000101',
      ),
    ).resolves.toEqual({ parent_name: 'Ava Mitchell', pet_name: 'Biscuit' });

    const [query, values] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(query)).toContain('p.pet_owners_uuid');
    expect(String(query)).toContain('po.users_uuid = $2::uuid');
    expect(values).toEqual([
      '00000000-0000-4000-8000-000000000501',
      '00000000-0000-4000-8000-000000000101',
    ]);
  });

  it('creates a Praise feedback and submitted timeline event in one transaction', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000b16' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await createFeedbackRecord({
      pet_uuid: '00000000-0000-4000-8000-000000000501',
      pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
      category: 'Praise',
      rating: 4,
      rating_details: ratingDetails,
      raw_answer: 'The parent answer.',
      audio_url: null,
      ai_insights: { summary: 'Summary', insights: ['Insight'] },
      initial_timeline_step: 'submitted',
      initial_event_payload: { actor: 'System' },
    });

    expect(result).toEqual({ uuid: '00000000-0000-4000-8000-000000000b16' });
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');

    const [query, values] = client.query.mock.calls[1] ?? [];
    expect(String(query)).toContain('INSERT INTO feedback');
    expect(String(query)).toContain('RETURNING uuid');
    expect(String(query)).not.toMatch(/INSERT INTO feedback\s*\(\s*uuid/);
    expect(values).toEqual([
      '00000000-0000-4000-8000-000000000501',
      '00000000-0000-4000-8000-000000000101',
      'Praise',
      4,
      JSON.stringify(ratingDetails),
      'The parent answer.',
      null,
      JSON.stringify({ summary: 'Summary', insights: ['Insight'] }),
    ]);
    const [timelineQuery, timelineValues] = client.query.mock.calls[2] ?? [];
    expect(String(timelineQuery)).toContain('INSERT INTO feedback_timeline_events');
    expect(timelineValues).toEqual([
      '00000000-0000-4000-8000-000000000b16',
      'submitted',
      JSON.stringify({ actor: 'System' }),
    ]);
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('persists a Suggestion captured event with its initial workflow payload', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000b17' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await createFeedbackRecord({
      pet_uuid: '00000000-0000-4000-8000-000000000501',
      pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
      category: 'Suggestion',
      rating: 4,
      rating_details: ratingDetails,
      raw_answer: 'The parent suggestion.',
      audio_url: null,
      ai_insights: { summary: 'Summary', insights: [] },
      initial_timeline_step: 'captured',
      initial_event_payload: {
        workflow_type: 'suggestion',
        ownerId: 'u1',
        decision: null,
        evidenceSummary: null,
        decisionReason: null,
        nextReviewAt: null,
        actor: 'System',
      },
    });

    const [timelineQuery, timelineValues] = client.query.mock.calls[2] ?? [];
    expect(String(timelineQuery)).toContain('INSERT INTO feedback_timeline_events');
    expect(timelineValues).toEqual([
      '00000000-0000-4000-8000-000000000b17',
      'captured',
      JSON.stringify({
        workflow_type: 'suggestion',
        ownerId: 'u1',
        decision: null,
        evidenceSummary: null,
        decisionReason: null,
        nextReviewAt: null,
        actor: 'System',
      }),
    ]);
  });

  it('rolls back when PostgreSQL returns no generated UUID', async () => {
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      createFeedbackRecord({
        pet_uuid: '00000000-0000-4000-8000-000000000501',
        pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
        category: 'Issue',
        rating: 4,
        rating_details: ratingDetails,
        raw_answer: 'The parent answer.',
        audio_url: null,
        ai_insights: { summary: 'Summary', insights: [] },
        initial_timeline_step: 'submitted',
        initial_event_payload: { actor: 'System' },
      }),
    ).rejects.toThrow('Feedback insert returned no UUID');

    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the initial timeline event cannot be inserted', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{ uuid: '00000000-0000-4000-8000-000000000b18' }],
        rowCount: 1,
      })
      .mockRejectedValueOnce(new Error('Timeline insert failed'))
      .mockResolvedValueOnce({});

    await expect(
      createFeedbackRecord({
        pet_uuid: '00000000-0000-4000-8000-000000000501',
        pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
        category: 'Praise',
        rating: 4,
        rating_details: ratingDetails,
        raw_answer: 'The parent answer.',
        audio_url: null,
        ai_insights: { summary: 'Summary', insights: [] },
        initial_timeline_step: 'submitted',
        initial_event_payload: { actor: 'System' },
      }),
    ).rejects.toThrow('Timeline insert failed');

    expect(client.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { StoredSummary } from '../repositories/daily-summary.repository.js';

const STAY = '00000000-0000-4000-8000-000000000301';

const stored = (photoPath: string | null): StoredSummary => ({
  id: 's1',
  bookingPetId: STAY,
  date: '2026-12-13',
  kind: 'daily',
  body: 'There is a short video of Bella from today with this update on Live care.',
  locale: 'en',
  photoPath,
  facts: {},
  generatedAt: new Date('2026-12-13T04:05:00Z'),
});

const summaries = vi.hoisted(() => ({ summariesForOwner: vi.fn() }));
vi.mock('../services/daily-summary.service.js', () => summaries);

const { getStaySummaries } = await import('../controllers/petparent.summaries.controller.js');

/** Runs the handler for the signed-in owner and returns the JSON it sent. */
const answer = async (): Promise<{ summaries: Array<Record<string, unknown>> }> => {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const req = { user: { id: 'owner-1' }, params: { bookingPetId: STAY } } as unknown as Request;
  await getStaySummaries(req, res, vi.fn() as unknown as NextFunction);
  return json.mock.calls[0]?.[0] as { summaries: Array<Record<string, unknown>> };
};

// The update's media says whether its path is a photo or a short video; the old photo path stays.
describe('stay summaries payload', () => {
  it('marks a video update as a video and keeps the photo path for older readers', async () => {
    summaries.summariesForOwner.mockResolvedValue([stored('/tasks/t1/photos/walk.mp4?inline=1')]);
    const body = await answer();
    expect(body.summaries[0]).toMatchObject({
      photoPath: '/tasks/t1/photos/walk.mp4?inline=1',
      media: { kind: 'video', url: '/tasks/t1/photos/walk.mp4?inline=1' },
    });
  });

  it('marks a photo update as a photo, and an update without media as none', async () => {
    summaries.summariesForOwner.mockResolvedValue([
      stored('/tasks/t1/photos/yard.jpg?inline=1'),
      stored(null),
    ]);
    const body = await answer();
    expect(body.summaries[0]?.media).toEqual({
      kind: 'photo',
      url: '/tasks/t1/photos/yard.jpg?inline=1',
    });
    expect(body.summaries[1]?.media).toBeNull();
  });
});

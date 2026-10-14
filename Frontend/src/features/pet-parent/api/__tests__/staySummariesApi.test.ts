import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '../bookingApi';
import { fetchStaySummaries } from '../staySummariesApi';

const VIDEO_PATH = '/tasks/t1/photos/walk.mp4?inline=1';

const serverSummary = {
  id: 's1',
  bookingPetId: 'bp-1',
  date: '2026-12-13',
  kind: 'daily',
  locale: 'en',
  body: 'There is a short video of Biscuit from today with this update on Live care.',
  photoPath: VIDEO_PATH,
  media: { kind: 'video', url: VIDEO_PATH },
  facts: {},
  generatedAt: '2026-12-13T04:05:00.000Z',
};

describe('fetchStaySummaries', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Pick<Response, 'ok' | 'json'>> => ({
        ok: true,
        json: async (): Promise<unknown> => ({
          summaries: [serverSummary, { ...serverSummary, id: 's0', photoPath: null, media: null }],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns the update's media path into a URL the browser loads, keeping its kind", async () => {
    const [video, empty] = await fetchStaySummaries('bp-1');

    expect(video?.media).toEqual({ kind: 'video', url: `${API_BASE}${VIDEO_PATH}` });
    expect(video?.photoPath).toBe(`${API_BASE}${VIDEO_PATH}`);
    expect(empty?.media).toBeNull();
    expect(empty?.photoPath).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGoogleReviewDashboard } from '../googleReviewDashboardApi';

const dashboard = {
  scope: {
    placeSlug: 'PetHouse' as const,
    locationName: 'PetHouse',
    periodStart: '2025-10-01T00:00:00.000Z',
    periodEnd: '2026-09-03T00:00:00.000Z',
    timezone: 'Pacific/Auckland' as const,
    granularity: 'half-month' as const,
  },
  freshness: {
    dataOrigin: 'mock' as const,
    lastObservedAt: null,
    refreshedAt: '2026-09-03T00:00:00.000Z',
  },
  managerAttention: { issuesNeedReview: 1, overdueReplies: 2, approachingThreshold: 3 },
  rating: { average: 4.2, reviewCount: 10 },
  feedbackMix: {
    total: 10,
    segments: [{ type: 'praise' as const, count: 10, percentage: 100 }],
  },
  responseHealth: {
    pendingCount: 5,
    oldestWaitingHours: 30,
    buckets: [
      { key: 'safe' as const, label: 'Safe', minHours: 0, maxHours: 4, count: 1 },
      { key: 'watch' as const, label: 'Monitor', minHours: 4, maxHours: 12, count: 1 },
      { key: 'attention' as const, label: 'Reply soon', minHours: 12, maxHours: 24, count: 1 },
      { key: 'overdue' as const, label: 'Overdue', minHours: 24, maxHours: null, count: 2 },
    ],
  },
  feedbackFlow: {
    granularity: 'half-month' as const,
    points: [{ periodStart: '2026-09-01', receivedCount: 1, repliedCount: 1 }],
  },
};

describe('fetchGoogleReviewDashboard', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('loads the manager dashboard with the selected date period', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: dashboard }),
    });

    await expect(
      fetchGoogleReviewDashboard({
        placeSlug: 'PetHouse',
        from: '2026-01-01',
        to: '2026-01-31',
      }),
    ).resolves.toEqual(dashboard);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/google-reviews/dashboard?placeSlug=PetHouse&from=2026-01-01&to=2026-01-31',
      { credentials: 'include', signal: undefined },
    );
  });

  it('rejects a successful response with an invalid dashboard contract', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        data: { ...dashboard, rating: { average: 6, reviewCount: 10 } },
      }),
    });

    await expect(fetchGoogleReviewDashboard({ placeSlug: 'PetHouse' })).rejects.toThrow(
      'Invalid Google review dashboard response',
    );
  });

  it('accepts one-decimal feedback mix percentages', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        data: {
          ...dashboard,
          feedbackMix: {
            total: 31,
            segments: [
              { type: 'issue', count: 2, percentage: 6.5 },
              { type: 'suggestion', count: 1, percentage: 3.2 },
              { type: 'praise', count: 28, percentage: 90.3 },
            ],
          },
        },
      }),
    });

    await expect(fetchGoogleReviewDashboard({ placeSlug: 'PetHouse' })).resolves.toMatchObject({
      feedbackMix: {
        segments: expect.arrayContaining([
          { type: 'issue', count: 2, percentage: 6.5 },
          { type: 'suggestion', count: 1, percentage: 3.2 },
          { type: 'praise', count: 28, percentage: 90.3 },
        ]),
      },
    });
  });

  it('surfaces the server error without exposing an internal response object', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Dashboard unavailable.' } }),
    });

    await expect(fetchGoogleReviewDashboard({ placeSlug: 'PetHouse' })).rejects.toMatchObject({
      name: 'GoogleReviewDashboardApiError',
      message: 'Dashboard unavailable.',
      status: 503,
    });
  });
});

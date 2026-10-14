import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleReviewManagerCorrection } from '../contracts/google.review.manager.correction.contract.js';
import { getAdminGoogleReviewDashboard } from '../services/admin.google.review.dashboard.service.js';

const { findGoogleReviewDashboardRecordsMock } = vi.hoisted(() => ({
  findGoogleReviewDashboardRecordsMock: vi.fn(),
}));

vi.mock('../repositories/admin.google.review.dashboard.repository.js', () => ({
  findGoogleReviewDashboardRecords: findGoogleReviewDashboardRecordsMock,
}));

const location = {
  id: 'location-1',
  display_name: 'PetHouse',
  data_origin: 'mock' as const,
  last_observed_at: new Date('2026-09-03T10:00:00.000Z'),
};

const makeManualType = (
  reviewUuid: string,
  correctedType: 'issue' | 'praise',
): GoogleReviewManagerCorrection => ({
  correctionId: '00000000-0000-4000-8000-000000009001',
  reviewUuid,
  sourceRunId: null,
  originalAiType: null,
  correctedType,
  managerId: '00000000-0000-4000-8000-000000000201',
  occurredAt: '2026-09-03T10:00:00.000Z',
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
  findGoogleReviewDashboardRecordsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getAdminGoogleReviewDashboard', () => {
  it('returns rating and workflow metrics using manager-selected review types', async () => {
    findGoogleReviewDashboardRecordsMock.mockResolvedValueOnce({
      location,
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000009002',
          rating: 1,
          google_created_at: new Date('2026-09-03T00:00:00.000Z'),
          manager_correction: makeManualType('00000000-0000-4000-8000-000000009002', 'issue'),
          latest_successful_reply_at: null,
        },
        {
          id: '00000000-0000-4000-8000-000000009003',
          rating: 5,
          google_created_at: new Date('2026-08-10T00:00:00.000Z'),
          manager_correction: makeManualType('00000000-0000-4000-8000-000000009003', 'praise'),
          latest_successful_reply_at: new Date('2026-08-11T00:00:00.000Z'),
        },
        {
          id: '00000000-0000-4000-8000-000000009004',
          rating: 3,
          google_created_at: new Date('2026-09-03T10:00:00.000Z'),
          manager_correction: null,
          latest_successful_reply_at: null,
        },
      ],
      replyEvents: [
        {
          review_id: '00000000-0000-4000-8000-000000009003',
          sent_at: new Date('2026-08-11T00:00:00.000Z'),
        },
      ],
    });

    await expect(getAdminGoogleReviewDashboard({ placeSlug: 'PetHouse' })).resolves.toMatchObject({
      scope: {
        placeSlug: 'PetHouse',
        locationName: 'PetHouse',
        timezone: 'Pacific/Auckland',
        granularity: 'half-month',
      },
      freshness: {
        dataOrigin: 'mock',
        lastObservedAt: '2026-09-03T10:00:00.000Z',
        refreshedAt: '2026-09-03T12:00:00.000Z',
      },
      managerAttention: {
        issuesNeedReview: 1,
        overdueReplies: 0,
        approachingThreshold: 1,
      },
      rating: { average: 3, reviewCount: 3 },
      feedbackMix: {
        total: 3,
        segments: [
          { type: 'issue', count: 1, percentage: 33.4 },
          { type: 'praise', count: 1, percentage: 33.3 },
          { type: 'unclassified', count: 1, percentage: 33.3 },
        ],
      },
      responseHealth: { pendingCount: 2 },
    });
    expect(findGoogleReviewDashboardRecordsMock).toHaveBeenCalledWith('PetHouse');
  });

  it('treats an invalid non-null manual type as a controlled data error', async () => {
    findGoogleReviewDashboardRecordsMock.mockResolvedValueOnce({
      location,
      reviews: [
        {
          id: '00000000-0000-4000-8000-000000009005',
          rating: 3,
          google_created_at: new Date('2026-09-03T00:00:00.000Z'),
          manager_correction: { invalid: true },
          latest_successful_reply_at: null,
        },
      ],
      replyEvents: [],
    });

    await expect(getAdminGoogleReviewDashboard({ placeSlug: 'PetHouse' })).rejects.toMatchObject({
      code: 'INVALID_GOOGLE_REVIEW_TYPE',
      statusCode: 500,
    });
  });

  it('returns a location-not-found error when PetHouse is not configured', async () => {
    findGoogleReviewDashboardRecordsMock.mockResolvedValueOnce(null);

    await expect(getAdminGoogleReviewDashboard({ placeSlug: 'PetHouse' })).rejects.toMatchObject({
      code: 'GOOGLE_REVIEW_LOCATION_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('does not expose another location through the fixed PetHouse dashboard contract', async () => {
    await expect(getAdminGoogleReviewDashboard({ placeSlug: 'K9-Heaven' })).rejects.toMatchObject({
      code: 'GOOGLE_REVIEW_LOCATION_NOT_FOUND',
      statusCode: 404,
    });
    expect(findGoogleReviewDashboardRecordsMock).not.toHaveBeenCalled();
  });
});

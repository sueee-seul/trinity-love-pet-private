import { describe, expect, it } from 'vitest';
import {
  calculateGoogleReviewDashboardMetrics,
  type GoogleReviewDashboardReplyEventInput,
  type GoogleReviewDashboardReviewInput,
} from '../services/google.review.dashboard.metrics.js';

const now = new Date('2026-09-03T12:00:00.000Z');
const periodStart = new Date('2026-08-01T00:00:00.000Z');
const periodEnd = new Date('2026-09-30T11:00:00.000Z');

const reviews: GoogleReviewDashboardReviewInput[] = [
  {
    id: 'issue-pending',
    rating: 1,
    receivedAt: new Date('2026-09-01T06:00:00.000Z'),
    triageType: 'issue',
    latestSuccessfulReplyAt: null,
  },
  {
    id: 'issue-replied',
    rating: 2,
    receivedAt: new Date('2026-08-10T06:00:00.000Z'),
    triageType: 'issue',
    latestSuccessfulReplyAt: new Date('2026-09-02T06:00:00.000Z'),
  },
  {
    id: 'suggestion-pending',
    rating: 3,
    receivedAt: new Date('2026-09-03T00:00:00.000Z'),
    triageType: 'suggestion',
    latestSuccessfulReplyAt: null,
  },
  {
    id: 'praise-pending',
    rating: 4,
    receivedAt: new Date('2026-09-03T04:00:00.000Z'),
    triageType: 'praise',
    latestSuccessfulReplyAt: null,
  },
  {
    id: 'unclassified-pending',
    rating: 5,
    receivedAt: new Date('2026-09-03T10:00:00.000Z'),
    triageType: 'unclassified',
    latestSuccessfulReplyAt: null,
  },
  {
    id: 'old-review-replied-this-period',
    rating: 5,
    receivedAt: new Date('2026-07-15T06:00:00.000Z'),
    triageType: 'praise',
    latestSuccessfulReplyAt: new Date('2026-09-02T08:00:00.000Z'),
  },
];

const replyEvents: GoogleReviewDashboardReplyEventInput[] = [
  { reviewId: 'issue-replied', sentAt: new Date('2026-09-02T06:00:00.000Z') },
  {
    reviewId: 'old-review-replied-this-period',
    sentAt: new Date('2026-09-02T08:00:00.000Z'),
  },
];

describe('calculateGoogleReviewDashboardMetrics', () => {
  it('calculates period rating, mix, manager attention, pending aging, and half-month flow', () => {
    const metrics = calculateGoogleReviewDashboardMetrics({
      reviews,
      replyEvents,
      periodStart,
      periodEnd,
      now,
    });

    expect(metrics.managerAttention).toEqual({
      issuesNeedReview: 1,
      overdueReplies: 1,
      approachingThreshold: 1,
    });
    expect(metrics.rating).toEqual({ average: 3, reviewCount: 5 });
    expect(metrics.feedbackMix).toEqual({
      total: 5,
      segments: [
        { type: 'issue', count: 2, percentage: 40 },
        { type: 'suggestion', count: 1, percentage: 20 },
        { type: 'praise', count: 1, percentage: 20 },
        { type: 'unclassified', count: 1, percentage: 20 },
      ],
    });
    expect(metrics.responseHealth).toMatchObject({
      pendingCount: 4,
      oldestWaitingHours: 54,
    });
    expect(metrics.responseHealth.buckets).toEqual([
      expect.objectContaining({ key: 'safe', label: 'Safe', count: 1 }),
      expect.objectContaining({ key: 'watch', label: 'Monitor', count: 1 }),
      expect.objectContaining({ key: 'attention', label: 'Reply soon', count: 1 }),
      expect.objectContaining({ key: 'overdue', label: 'Overdue', count: 1 }),
    ]);
    expect(metrics.feedbackFlow).toEqual({
      granularity: 'half-month',
      points: [
        { periodStart: '2026-08-01', receivedCount: 1, repliedCount: 0 },
        { periodStart: '2026-08-16', receivedCount: 0, repliedCount: 0 },
        { periodStart: '2026-09-01', receivedCount: 4, repliedCount: 2 },
        { periodStart: '2026-09-16', receivedCount: 0, repliedCount: 0 },
      ],
    });
  });

  it('rounds feedback mix percentages to one decimal and preserves a 100 percent total', () => {
    const metrics = calculateGoogleReviewDashboardMetrics({
      reviews: Array.from({ length: 31 }, (_, index) => ({
        id: `mix-${index}`,
        rating: 5,
        receivedAt: new Date('2026-09-03T00:00:00.000Z'),
        triageType: index < 2 ? 'issue' : index === 2 ? 'suggestion' : 'praise',
        latestSuccessfulReplyAt: null,
      })),
      replyEvents: [],
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-10-01T00:00:00.000Z'),
      now,
    });

    expect(metrics.feedbackMix.segments).toEqual([
      { type: 'issue', count: 2, percentage: 6.5 },
      { type: 'suggestion', count: 1, percentage: 3.2 },
      { type: 'praise', count: 28, percentage: 90.3 },
    ]);
    expect(metrics.feedbackMix.segments.reduce((sum, segment) => sum + segment.percentage, 0)).toBe(
      100,
    );
  });

  it.each([
    ['safe', 3.99],
    ['watch', 4],
    ['attention', 12],
    ['overdue', 24],
  ] as const)('places an age of %s at its exact threshold', (expectedBucket, ageHours) => {
    const review: GoogleReviewDashboardReviewInput = {
      id: `boundary-${expectedBucket}`,
      rating: 3,
      receivedAt: new Date(now.getTime() - ageHours * 60 * 60 * 1000),
      triageType: 'praise',
      latestSuccessfulReplyAt: null,
    };

    const metrics = calculateGoogleReviewDashboardMetrics({
      reviews: [review],
      replyEvents: [],
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-10-01T00:00:00.000Z'),
      now,
    });

    expect(metrics.responseHealth.buckets.find((bucket) => bucket.count === 1)?.key).toBe(
      expectedBucket,
    );
  });

  it('returns a null average and empty mix when the selected period has no reviews', () => {
    const metrics = calculateGoogleReviewDashboardMetrics({
      reviews: [
        {
          id: 'outside-period',
          rating: 5,
          receivedAt: new Date('2025-01-01T00:00:00.000Z'),
          triageType: 'praise',
          latestSuccessfulReplyAt: null,
        },
      ],
      replyEvents: [],
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      now,
    });

    expect(metrics.managerAttention).toEqual({
      issuesNeedReview: 0,
      overdueReplies: 0,
      approachingThreshold: 0,
    });
    expect(metrics.responseHealth).toMatchObject({
      pendingCount: 0,
      oldestWaitingHours: null,
    });
    expect(metrics.responseHealth.buckets.every((bucket) => bucket.count === 0)).toBe(true);
    expect(metrics.rating).toEqual({ average: null, reviewCount: 0 });
    expect(metrics.feedbackMix).toEqual({ total: 0, segments: [] });
  });
});

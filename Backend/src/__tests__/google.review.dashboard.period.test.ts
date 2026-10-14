import { describe, expect, it } from 'vitest';
import { resolveGoogleReviewDashboardPeriod } from '../services/google.review.dashboard.period.js';

describe('resolveGoogleReviewDashboardPeriod', () => {
  it('uses twelve Auckland calendar months ending at the request time by default', () => {
    const period = resolveGoogleReviewDashboardPeriod(
      { placeSlug: 'PetHouse' },
      new Date('2026-09-03T12:00:00.000Z'),
    );

    expect(period).toEqual({
      start: new Date('2025-09-30T11:00:00.000Z'),
      end: new Date('2026-09-03T12:00:00.000Z'),
    });
  });

  it('treats custom from and to values as inclusive Auckland local dates', () => {
    const period = resolveGoogleReviewDashboardPeriod(
      { placeSlug: 'PetHouse', from: '2026-01-15', to: '2026-01-15' },
      new Date('2026-09-03T12:00:00.000Z'),
    );

    expect(period).toEqual({
      start: new Date('2026-01-14T11:00:00.000Z'),
      end: new Date('2026-01-15T11:00:00.000Z'),
    });
  });
});

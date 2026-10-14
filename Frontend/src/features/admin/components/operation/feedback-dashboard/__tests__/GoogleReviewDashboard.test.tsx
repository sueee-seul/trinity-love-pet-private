// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { GoogleReviewDashboard } from '../GoogleReviewDashboard';
import type { GoogleReviewDashboardState } from '../../../../types/googleReviewDashboard';

const { useAdminGoogleReviewDashboardMock } = vi.hoisted(() => ({
  useAdminGoogleReviewDashboardMock: vi.fn(),
}));

vi.mock('../../../../hooks/useAdminGoogleReviewDashboard', () => ({
  useAdminGoogleReviewDashboard: useAdminGoogleReviewDashboardMock,
}));

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
    lastObservedAt: '2026-09-03T00:00:00.000Z',
    refreshedAt: '2026-09-03T00:05:00.000Z',
  },
  managerAttention: {
    issuesNeedReview: 2,
    overdueReplies: 1,
    approachingThreshold: 3,
  },
  rating: { average: 4.5, reviewCount: 2 },
  feedbackMix: {
    total: 2,
    segments: [
      { type: 'issue' as const, count: 1, percentage: 50 },
      { type: 'praise' as const, count: 1, percentage: 50 },
    ],
  },
  responseHealth: {
    pendingCount: 4,
    oldestWaitingHours: 30,
    buckets: [
      { key: 'safe' as const, label: 'Safe', minHours: 0, maxHours: 4, count: 1 },
      { key: 'watch' as const, label: 'Monitor', minHours: 4, maxHours: 12, count: 1 },
      { key: 'attention' as const, label: 'Reply soon', minHours: 12, maxHours: 24, count: 1 },
      { key: 'overdue' as const, label: 'Overdue', minHours: 24, maxHours: null, count: 1 },
    ],
  },
  feedbackFlow: {
    granularity: 'half-month' as const,
    points: [
      { periodStart: '2026-08-01', receivedCount: 1, repliedCount: 0 },
      { periodStart: '2026-08-16', receivedCount: 0, repliedCount: 0 },
      { periodStart: '2026-09-01', receivedCount: 1, repliedCount: 1 },
    ],
  },
} satisfies NonNullable<GoogleReviewDashboardState['dashboard']>;

const LocationProbe = (): React.ReactElement => {
  const location = useLocation();
  return (
    <output data-testid="dashboard-location">
      {location.pathname}
      {location.search}
    </output>
  );
};

const renderDashboard = (includeLocation = false): void => {
  render(
    <MemoryRouter initialEntries={['/admin/operation']}>
      <GoogleReviewDashboard />
      {includeLocation && <LocationProbe />}
    </MemoryRouter>,
  );
};

describe('GoogleReviewDashboard', () => {
  beforeEach(() => {
    useAdminGoogleReviewDashboardMock.mockReturnValue({
      dashboard,
      status: 'ready',
      error: null,
      refresh: vi.fn(),
    });
  });

  it('renders the five overview regions without a second feedback table or attention arrows', () => {
    renderDashboard();

    expect(screen.getByTestId('manager-attention-section')).toBeInTheDocument();
    expect(screen.getByTestId('average-google-review-rating-section')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-mix-section')).toBeInTheDocument();
    expect(screen.getByTestId('response-health-section')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-flow-section')).toBeInTheDocument();
    expect(screen.getByText('Unreplied issues')).toBeInTheDocument();
    expect(screen.queryByText('Unreplied negative feedback')).not.toBeInTheDocument();
    expect(screen.getByText('No successful reply; classified as Issue')).toBeInTheDocument();
    expect(
      screen.getByText('Within the 24-hour reply SLA, waiting 12h to under 24h'),
    ).toBeInTheDocument();
    expect(screen.getByText('No successful reply at 24h+ under the reply SLA')).toBeInTheDocument();
    expect(
      screen.getByText('Signals may overlap; open matching reviews separately.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Reviews at 24h+ are overdue under the 24-hour reply SLA. Use this view to prioritize reviews approaching or exceeding the SLA.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AI Review Summary/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Feedback Mix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Feedback Flow' })).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        '/admin/feedback?source=google-reviews&status=unreplied&type=issue',
        '/admin/feedback?source=google-reviews&status=unreplied&age=overdue',
        '/admin/feedback?source=google-reviews&status=unreplied&age=approaching',
      ]),
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the PetHouse scope, selected-period rating, mix values, and half-month flow labels', () => {
    renderDashboard();

    expect(screen.getByText('PetHouse')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Based on 2 reviews')).toBeInTheDocument();
    expect(screen.getByText('Issue')).toBeInTheDocument();
    expect(screen.getByText('Praise')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
    expect(screen.getByText('Aug 1 to 15')).toBeInTheDocument();
    expect(screen.getByText('Aug 16 to 31')).toBeInTheDocument();
    expect(screen.getByText('Sept 1 to 15')).toBeInTheDocument();
  });

  it('keeps the page loading state separate from visual empty states', () => {
    useAdminGoogleReviewDashboardMock.mockReturnValueOnce({
      dashboard: null,
      status: 'loading',
      error: null,
      refresh: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText('Loading Google review dashboard…')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-attention-section')).not.toBeInTheDocument();
    expect(screen.queryByText('No reviews in the selected period.')).not.toBeInTheDocument();
  });

  it('keeps the page error state actionable', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    useAdminGoogleReviewDashboardMock.mockReturnValueOnce({
      dashboard: null,
      status: 'error',
      error: 'Dashboard unavailable.',
      refresh,
    });

    renderDashboard();

    expect(screen.getByRole('alert')).toHaveTextContent('Dashboard unavailable.');
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('navigates from Manager Attention to the Google Reviews page', async () => {
    const user = userEvent.setup();
    renderDashboard(true);

    const overdueReplyLink = screen
      .getAllByRole('link')
      .find(
        (link) =>
          link.getAttribute('href') ===
          '/admin/feedback?source=google-reviews&status=unreplied&age=overdue',
      );
    if (!overdueReplyLink) {
      throw new Error('Expected an overdue feedback link.');
    }

    await user.click(overdueReplyLink);

    expect(screen.getByTestId('dashboard-location')).toHaveTextContent(
      '/admin/feedback?source=google-reviews&status=unreplied&age=overdue',
    );
  });

  it('uses the dashboard refresh timestamp when source observation is unavailable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    useAdminGoogleReviewDashboardMock.mockReturnValueOnce({
      dashboard: {
        ...dashboard,
        freshness: {
          ...dashboard.freshness,
          lastObservedAt: null,
          refreshedAt: '2026-09-03T12:00:00.000Z',
        },
      },
      status: 'ready',
      error: null,
      refresh: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText('Last refreshed: just now')).toBeInTheDocument();
    expect(screen.queryByText('Source freshness unavailable')).not.toBeInTheDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

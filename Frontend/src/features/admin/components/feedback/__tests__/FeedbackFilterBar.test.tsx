// @vitest-environment jsdom
import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackFilterBar } from '../FeedbackFilterBar';
import { FeedbackRangeFilter } from '../FeedbackRangeFilter';
import type { FeedbackRangeFilterValues } from '../feedbackRangeFilter.utils';
import {
  GoogleReviewDashboardAction,
  GoogleReviewFilterControls,
} from '../GoogleReviewFilterControls';
import type { GoogleReviewAgeFilter } from '../../../types/feedback';

const renderFilterBar = (
  onRangeFiltersChange: (values: FeedbackRangeFilterValues) => void,
  onOpenDashboard: () => void = vi.fn(),
  ageFilter: GoogleReviewAgeFilter = 'all',
  onAgeFilterChange: (value: GoogleReviewAgeFilter) => void = vi.fn(),
): RenderResult => {
  return render(
    <FeedbackFilterBar
      searchQuery=""
      onSearchChange={vi.fn()}
      statusFilter="all"
      onStatusChange={vi.fn()}
      hasUnreadNotification={false}
      onUnreadClick={vi.fn()}
      typeFilter="All"
      onTypeChange={vi.fn()}
      sortOption="newest"
      onSortChange={vi.fn()}
      toolbarActions={<GoogleReviewDashboardAction onClick={onOpenDashboard} />}
      additionalFilters={
        <GoogleReviewFilterControls ageFilter={ageFilter} onAgeFilterChange={onAgeFilterChange} />
      }
      rangeFilter={
        <FeedbackRangeFilter
          timeRange="all"
          ratingMin={1}
          ratingMax={5}
          dateFrom=""
          dateTo=""
          timeDomain={{ min: '2026-08-01', max: '2026-08-31' }}
          onRangeFiltersChange={onRangeFiltersChange}
        />
      }
      viewMode="table"
      onViewModeChange={vi.fn()}
    />,
  );
};

describe('FeedbackFilterBar range filters', () => {
  it('places the Feedback Dashboard action before the table and card toggle', async () => {
    const user = userEvent.setup();
    const onOpenDashboard = vi.fn();
    renderFilterBar(vi.fn(), onOpenDashboard);

    const topRow = screen.getByTestId('feedback-toolbar-top-row');
    const dashboardButton = screen.getByRole('button', { name: 'Feedback Dashboard' });
    const viewToggle = screen.getByRole('tablist', { name: 'Feedback view' });

    expect(topRow).toContainElement(dashboardButton);
    expect(topRow).toContainElement(viewToggle);
    expect(
      dashboardButton.compareDocumentPosition(viewToggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(dashboardButton);
    expect(onOpenDashboard).toHaveBeenCalledOnce();
  });

  it('shows and changes the Google review age filter', async () => {
    const user = userEvent.setup();
    const onAgeFilterChange = vi.fn();
    renderFilterBar(vi.fn(), vi.fn(), 'overdue', onAgeFilterChange);

    const ageFilter = screen.getAllByRole('combobox')[1];
    expect(ageFilter).toHaveValue('overdue');

    await user.selectOptions(ageFilter, 'approaching');

    expect(onAgeFilterChange).toHaveBeenCalledWith('approaching');
  });

  it('renders accessible range sliders and applies values immediately', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderFilterBar(onRangeFiltersChange);

    const topRow = screen.getByTestId('feedback-toolbar-top-row');
    const filterRow = screen.getByTestId('feedback-filter-row');
    expect(filterRow).toHaveClass('justify-start', 'lg:justify-between');
    expect(topRow).toContainElement(screen.getByPlaceholderText('Search feedback...'));
    expect(topRow).toContainElement(screen.getByRole('tablist', { name: 'Feedback view' }));
    expect(filterRow).toContainElement(
      screen.getByRole('button', { name: 'Open time and rating filters' }),
    );
    expect(topRow).not.toContainElement(
      screen.getByRole('button', { name: 'Open time and rating filters' }),
    );

    expect(screen.getAllByRole('button', { name: 'Open time and rating filters' })).toHaveLength(1);
    expect(screen.getByText('Time & Rating')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));

    expect(screen.getByTestId('feedback-range-popover')).toHaveClass('sm:flex-row');
    expect(screen.getByTestId('feedback-range-trigger-wrapper')).toHaveClass('relative');
    expect(screen.getByTestId('feedback-range-popover')).toHaveClass('top-full', 'right-0');
    expect(screen.getAllByRole('slider')).toHaveLength(4);

    fireEvent.change(screen.getByRole('slider', { name: 'Feedback time range start' }), {
      target: { value: String(Date.parse('2026-08-08T00:00:00Z')) },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Feedback time range end' }), {
      target: { value: String(Date.parse('2026-08-20T00:00:00Z')) },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Minimum feedback rating' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Maximum feedback rating' }), {
      target: { value: '4' },
    });

    expect(screen.getByRole('slider', { name: 'Minimum feedback rating' })).toHaveValue('2');
    expect(screen.getByRole('slider', { name: 'Maximum feedback rating' })).toHaveValue('4');

    expect(onRangeFiltersChange).toHaveBeenLastCalledWith({
      timeRange: 'custom',
      dateFrom: '2026-08-08',
      dateTo: '2026-08-20',
      ratingMin: 2,
      ratingMax: 4,
    });
    expect(onRangeFiltersChange).toHaveBeenCalledTimes(4);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
  });

  it('resets applied time and rating ranges to all time and 1.0 to 5.0', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderFilterBar(onRangeFiltersChange);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Minimum feedback rating' }), {
      target: { value: '2' },
    });
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onRangeFiltersChange).toHaveBeenLastCalledWith({
      timeRange: 'all',
      dateFrom: '',
      dateTo: '',
      ratingMin: 1,
      ratingMax: 5,
    });
    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
  });

  it('emits all time when both time thumbs cover the full domain', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderFilterBar(onRangeFiltersChange);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Feedback time range start' }), {
      target: { value: String(Date.parse('2026-08-08T00:00:00Z')) },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Feedback time range start' }), {
      target: { value: String(Date.parse('2026-08-01T00:00:00Z')) },
    });

    expect(onRangeFiltersChange).toHaveBeenLastCalledWith({
      timeRange: 'all',
      dateFrom: '',
      dateTo: '',
      ratingMin: 1,
      ratingMax: 5,
    });
  });

  it('closes the open range popover with Escape without changing the filters', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderFilterBar(onRangeFiltersChange);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Minimum feedback rating' }), {
      target: { value: '2' },
    });
    const callCountBeforeEscape = onRangeFiltersChange.mock.calls.length;

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
    expect(onRangeFiltersChange).toHaveBeenCalledTimes(callCountBeforeEscape);
  });
});

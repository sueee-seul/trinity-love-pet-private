// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackRangeFilter } from '../FeedbackRangeFilter';
import type { FeedbackRangeFilterValues } from '../feedbackRangeFilter.utils';

const renderRangeFilter = (
  onRangeFiltersChange: (values: FeedbackRangeFilterValues) => void,
): void => {
  render(
    <FeedbackRangeFilter
      timeRange="all"
      ratingMin={1}
      ratingMax={5}
      dateFrom=""
      dateTo=""
      timeDomain={{ min: '2026-08-01', max: '2026-08-31' }}
      onRangeFiltersChange={onRangeFiltersChange}
    />,
  );
};

describe('FeedbackRangeFilter', () => {
  it('applies slider changes immediately and normalizes the selected ranges', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderRangeFilter(onRangeFiltersChange);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
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

    expect(onRangeFiltersChange).toHaveBeenLastCalledWith({
      timeRange: 'custom',
      dateFrom: '2026-08-08',
      dateTo: '2026-08-20',
      ratingMin: 2,
      ratingMax: 4,
    });
    expect(onRangeFiltersChange).toHaveBeenCalledTimes(4);
  });

  it('emits all time when the thumbs cover the full domain', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderRangeFilter(onRangeFiltersChange);

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

  it('resets the range and closes the popover', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderRangeFilter(onRangeFiltersChange);

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

  it('closes with Close or Escape without emitting an extra change', async () => {
    const user = userEvent.setup();
    const onRangeFiltersChange = vi.fn();
    renderRangeFilter(onRangeFiltersChange);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    const callCountBeforeClose = onRangeFiltersChange.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
    expect(onRangeFiltersChange).toHaveBeenCalledTimes(callCountBeforeClose);

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
    expect(onRangeFiltersChange).toHaveBeenCalledTimes(callCountBeforeClose);
  });
});

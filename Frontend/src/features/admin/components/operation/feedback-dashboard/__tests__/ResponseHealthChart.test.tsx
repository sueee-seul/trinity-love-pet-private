// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponseHealthChart } from '../ResponseHealthChart';
import type { GoogleReviewDashboard } from '../../../../types/googleReviewDashboard';

const responseHealth: GoogleReviewDashboard['responseHealth'] = {
  pendingCount: 4,
  oldestWaitingHours: 30,
  buckets: [
    { key: 'safe', label: 'Safe', minHours: 0, maxHours: 4, count: 1 },
    { key: 'watch', label: 'Monitor', minHours: 4, maxHours: 12, count: 1 },
    { key: 'attention', label: 'Reply soon', minHours: 12, maxHours: 24, count: 1 },
    { key: 'overdue', label: 'Overdue', minHours: 24, maxHours: null, count: 1 },
  ],
};

describe('ResponseHealthChart', () => {
  it('stacks each bucket label above its non-overlapping time range', () => {
    render(<ResponseHealthChart responseHealth={responseHealth} />);

    const safeLabel = screen.getByText('Safe');
    const header = safeLabel.parentElement;

    expect(header).not.toBeNull();
    expect(header).toHaveClass('flex-col', 'items-center', 'text-center');
    expect(screen.getByText('Under 4h')).toBeInTheDocument();
    expect(screen.getByText('4h to under 12h')).toBeInTheDocument();
    expect(screen.getByText('12h to under 24h')).toBeInTheDocument();
    expect(screen.getByText('24h+')).toBeInTheDocument();
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('Reply soon')).toBeInTheDocument();
    expect(
      screen.getByText('Reviews without a successful reply by time since received'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Reviews at 24h+ are overdue under the 24-hour reply SLA. Use this view to prioritize reviews approaching or exceeding the SLA.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Oldest waiting/)).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedbackFlowChart } from '../FeedbackFlowChart';
import type { GoogleReviewDashboard } from '../../../../types/googleReviewDashboard';

const flow: GoogleReviewDashboard['feedbackFlow'] = {
  granularity: 'half-month',
  points: [
    { periodStart: '2025-10-01', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2025-10-16', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2026-06-01', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2026-06-16', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2026-07-01', receivedCount: 2, repliedCount: 1 },
    { periodStart: '2026-07-16', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2026-08-01', receivedCount: 1, repliedCount: 1 },
  ],
};

const emptyFlow: GoogleReviewDashboard['feedbackFlow'] = {
  granularity: 'half-month',
  points: [
    { periodStart: '2026-07-01', receivedCount: 0, repliedCount: 0 },
    { periodStart: '2026-07-16', receivedCount: 0, repliedCount: 0 },
  ],
};

describe('FeedbackFlowChart', () => {
  it('hides only leading empty half-months and preserves empty half-months after activity starts', () => {
    render(<FeedbackFlowChart flow={flow} />);

    expect(screen.queryByText('Oct 1 to 15')).not.toBeInTheDocument();
    expect(screen.queryByText('Oct 16 to 31')).not.toBeInTheDocument();
    expect(screen.getByText('Jul 1 to 15')).toBeInTheDocument();
    expect(screen.getByText('Jul 16 to 31')).toBeInTheDocument();
    expect(screen.getByText('Aug 1 to 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Feedback Flow' })).toHaveAttribute(
      'title',
      'Compares reviews received and reviews replied to by half-month. Use it to monitor incoming review volume and reply activity over time; it is not a reply rate for the same reviews.',
    );
  });

  it('shows the period and both series counts on hover and keyboard focus', () => {
    render(<FeedbackFlowChart flow={flow} />);

    const periodTarget = screen.getByTestId('feedback-flow-period-2026-07-01');
    fireEvent.mouseEnter(periodTarget);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Jul 1 to 15');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Received: 2');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Replied: 1');

    fireEvent.mouseLeave(periodTarget);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(periodTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Jul 1 to 15');
  });

  it('shows the empty state when every half-month has no activity', () => {
    render(<FeedbackFlowChart flow={emptyFlow} />);

    expect(screen.getByText('No half-month activity in the selected period.')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('toggles a tooltip with click and closes it with Escape', () => {
    render(<FeedbackFlowChart flow={flow} />);

    const periodTarget = screen.getByTestId('feedback-flow-period-2026-08-01');
    fireEvent.click(periodTarget);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Aug 1 to 15');
    expect(periodTarget).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(periodTarget, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(periodTarget).toHaveAttribute('aria-expanded', 'false');
  });

  it('prevents mouse down from moving focus onto the chart period target', () => {
    render(<FeedbackFlowChart flow={flow} />);

    const periodTarget = screen.getByTestId('feedback-flow-period-2026-07-01');
    const mouseDownEvent = createEvent.mouseDown(periodTarget);
    fireEvent(periodTarget, mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InteractionProgress } from '../InteractionProgress';
import type { AdminFeedback } from '../../../../types/feedback';

const mockFeedback: AdminFeedback = {
  uuid: 'test-1',
  initials: 'JD',
  parentName: 'John Doe',
  petName: 'Buddy',
  date: 'Oct 26, 2026',
  timestamp: 1698330000000,
  serviceType: 'Walk',
  rating: 5,
  aiSummary: 'Great',
  category: 'Issue',
  is_read: true,
  assigneeId: null,
  current_status: 'submitted',
  timeline: [
    {
      step: 'submitted',
      timestamp: 'Oct 26, 2:30 PM',
      actor: 'System',
    },
  ],
};

describe('InteractionProgress', () => {
  it('renders the initial timeline correctly with submitted status', () => {
    render(<InteractionProgress feedback={mockFeedback} />);

    // Check if "Feedback Submitted" is rendered
    expect(screen.getByText('Feedback Submitted')).toBeDefined();
    expect(screen.getByText('Oct 26, 2:30 PM • System')).toBeDefined();

    // Check if "Staff Review Started" is pending
    expect(screen.getByText('Staff Review Started')).toBeDefined();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('renders Fact Check Completed correctly when completed', () => {
    const feedbackWithFactCheck = {
      ...mockFeedback,
      current_status: 'fact_checked' as const,
      timeline: [
        ...mockFeedback.timeline,
        { step: 'review_started' as const, timestamp: 'Oct 27, 9:00 AM', actor: 'Admin' },
        { step: 'fact_checked' as const, timestamp: 'Oct 27, 9:30 AM', actor: 'Admin' },
      ],
    };

    render(<InteractionProgress feedback={feedbackWithFactCheck} />);

    expect(screen.getByText('Oct 27, 9:30 AM • Admin')).toBeDefined();
  });

  it('treats submitted as completed when the current status advanced but the legacy event is missing', () => {
    const feedbackWithMissingSubmittedEvent = {
      ...mockFeedback,
      current_status: 'review_started' as const,
      timeline: [{ step: 'review_started' as const, timestamp: 'Oct 27, 9:00 AM', actor: 'Admin' }],
    };

    render(<InteractionProgress feedback={feedbackWithMissingSubmittedEvent} />);

    expect(screen.getByText(/Submitted on/)).toBeInTheDocument();
    expect(
      screen.getByText('Feedback Submitted').parentElement?.parentElement,
    ).not.toHaveTextContent('Pending');
  });
});

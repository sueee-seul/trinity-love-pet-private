// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminGoogleReview } from '../../../types/googleReview';
import { GoogleReviewCard } from '../GoogleReviewCard';

const review: AdminGoogleReview = {
  id: 'review-1',
  reviewerName: 'Andrew',
  reviewerEmail: 'andrew@example.test',
  reviewerAvatarUrl: null,
  reviewerIsAnonymous: false,
  rating: 5,
  reviewText: 'The stay was calm and comfortable.',
  photoUrls: [],
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  ownerReply: null,
  ownerReplyUpdatedAt: null,
  triageType: 'praise',
  isRead: false,
  currentStatus: 'received',
  assignedEmployeeUuid: null,
};

describe('GoogleReviewCard', () => {
  it('shows review content and manual type without generated analysis', () => {
    render(<GoogleReviewCard review={review} onViewDetails={vi.fn()} onReply={vi.fn()} />);

    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.getByText('The stay was calm and comfortable.')).toBeInTheDocument();
    expect(screen.getByText('Praise')).toBeInTheDocument();
    expect(screen.queryByText(/Evidence Check|Confidence:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI summary/i)).not.toBeInTheDocument();
  });

  it('opens a blank manual reply composer', async () => {
    const user = userEvent.setup();
    render(<GoogleReviewCard review={review} onViewDetails={vi.fn()} onReply={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByRole('dialog', { name: 'Reply to Andrew' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('');
  });
});

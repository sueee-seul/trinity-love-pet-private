import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationStatusBadge } from '../ConversationStatusBadge';

describe('ConversationStatusBadge', () => {
  it('shows the pulsing dot and label for Active', () => {
    const { container } = render(<ConversationStatusBadge status="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(container.querySelector('.bg-status-success')).not.toBeNull();
  });

  it('omits the dot for Closed', () => {
    render(<ConversationStatusBadge status="Closed" />);
    const badge = screen.getByText('Closed');
    expect(badge.querySelector('span')).toBeNull();
  });
});

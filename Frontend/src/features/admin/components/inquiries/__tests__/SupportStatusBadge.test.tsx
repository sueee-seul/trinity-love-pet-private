import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SUPPORT_STATUSES } from '../../../types/inquiry';
import { SupportStatusBadge } from '../SupportStatusBadge';

const EXPECTED_CLASS: Record<(typeof SUPPORT_STATUSES)[number], string> = {
  'AI Handling': 'bg-surface-deep',
  'Support Requested': 'bg-status-warning/10',
  'Support Assigned': 'bg-theme-apricot/40',
  'Support Handling': 'bg-status-success/10',
  Resolved: 'bg-action-dark/10',
};

describe('SupportStatusBadge', () => {
  it.each(SUPPORT_STATUSES)('renders the correct color class for %s', (status) => {
    render(<SupportStatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge).toHaveClass(EXPECTED_CLASS[status]);
  });

  it('shows the "Requested {time}" sub-line only when both requestedAt and the label are given', () => {
    render(
      <SupportStatusBadge
        status="Support Requested"
        requestedAt="2026-06-15T10:00:00.000Z"
        requestedAtLabel="Requested 10:00 AM"
      />,
    );
    expect(screen.getByText('Requested 10:00 AM')).toBeInTheDocument();
  });

  it('omits the sub-line when requestedAt is missing', () => {
    render(<SupportStatusBadge status="AI Handling" requestedAtLabel="Requested 10:00 AM" />);
    expect(screen.queryByText('Requested 10:00 AM')).not.toBeInTheDocument();
  });

  it('omits the sub-line when requestedAtLabel is missing', () => {
    render(<SupportStatusBadge status="AI Handling" requestedAt="2026-06-15T10:00:00.000Z" />);
    expect(screen.queryByText(/Requested/)).not.toBeInTheDocument();
  });
});

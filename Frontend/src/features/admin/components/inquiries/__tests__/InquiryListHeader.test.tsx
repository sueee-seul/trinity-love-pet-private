import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InquiryListHeader } from '../InquiryListHeader';

describe('InquiryListHeader', () => {
  it('calls onSearchQueryChange as the user types', async () => {
    const user = userEvent.setup();
    const onSearchQueryChange = vi.fn();
    render(<InquiryListHeader searchQuery="" onSearchQueryChange={onSearchQueryChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Search conversations' }), 'Sarah');

    expect(onSearchQueryChange).toHaveBeenCalled();
    expect(onSearchQueryChange.mock.calls.map((call) => call[0]).join('')).toBe('Sarah');
  });

  it('reflects the current searchQuery value', () => {
    render(<InquiryListHeader searchQuery="Bella" onSearchQueryChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toHaveValue('Bella');
  });
});

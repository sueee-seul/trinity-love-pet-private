// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackSourceTabs } from '../FeedbackSourceTabs';

describe('FeedbackSourceTabs', () => {
  it('renders both sources and marks Internal Feedback as active by default', () => {
    render(<FeedbackSourceTabs activeSource="internal" onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Internal Feedback' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Google Reviews' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('notifies the parent when a source is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeedbackSourceTabs activeSource="internal" onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'Google Reviews' }));

    expect(onChange).toHaveBeenCalledWith('google-reviews');
  });

  it('supports switching sources with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeedbackSourceTabs activeSource="internal" onChange={onChange} />);

    screen.getByRole('tab', { name: 'Internal Feedback' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('google-reviews');
  });
});

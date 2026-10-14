import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReplyField } from '../ReplyField';

describe('ReplyField', () => {
  it('sends a trimmed reply and clears the field on Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ReplyField parentFirstName="Sarah" onSend={onSend} />);

    const input = screen.getByPlaceholderText('Reply to Sarah as Customer Support…');
    await user.type(input, 'On it{Enter}');

    expect(onSend).toHaveBeenCalledWith('On it');
    expect(input).toHaveValue('');
  });

  it('sends via the send button and clears the field', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ReplyField parentFirstName="Sarah" onSend={onSend} />);

    const input = screen.getByPlaceholderText('Reply to Sarah as Customer Support…');
    await user.type(input, 'On it');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(onSend).toHaveBeenCalledWith('On it');
    expect(input).toHaveValue('');
  });

  it('does not send a whitespace-only reply', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ReplyField parentFirstName="Sarah" onSend={onSend} />);

    await user.type(
      screen.getByPlaceholderText('Reply to Sarah as Customer Support…'),
      '   {Enter}',
    );

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables both the input and the send button when disabled', () => {
    render(<ReplyField parentFirstName="Sarah" onSend={vi.fn()} disabled />);

    expect(screen.getByPlaceholderText('Reply to Sarah as Customer Support…')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
  });
});

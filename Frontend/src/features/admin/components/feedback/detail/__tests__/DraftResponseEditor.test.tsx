import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDictation } from '../../../../../../shared/dictation';
import { DraftResponseEditor } from '../DraftResponseEditor';

vi.mock('../../../../../../shared/dictation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../../shared/dictation')>()),
  useDictation: vi.fn(),
}));

const mockedUseDictation = vi.mocked(useDictation);

describe('DraftResponseEditor voice input', () => {
  let capturedOnChange: ((text: string) => void) | undefined;
  let toggle: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChange = undefined;
    toggle = vi.fn<() => Promise<void>>();
    mockedUseDictation.mockImplementation(({ value, onChange }) => {
      capturedOnChange = onChange;
      return {
        status: 'idle',
        isSupported: true,
        displayText: value,
        interimText: '',
        error: null,
        toggle,
        stop: vi.fn<() => Promise<void>>(),
      };
    });
  });

  it('places the shared dictation button inside the message field and delegates toggling', () => {
    render(<DraftResponseEditor />);

    const voiceButton = screen.getByRole('button', { name: 'Speak instead of typing' });
    const placement = voiceButton.parentElement;
    expect(placement?.className).toContain('absolute');
    expect(placement?.className).toContain('bottom-3');
    expect(placement?.className).toContain('right-3');

    fireEvent.click(voiceButton);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('uses dictated text as the mail message and sends it through the string callback', () => {
    const onSend = vi.fn();
    render(<DraftResponseEditor onSend={onSend} />);

    act(() => {
      capturedOnChange?.('Dictated reply');
    });

    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('Dictated reply');

    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

    expect(onSend).toHaveBeenCalledWith('Dictated reply');
  });

  it('loads manually provided reply text into the editor', () => {
    render(<DraftResponseEditor defaultMessage="Thank you for sharing your experience." />);

    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue(
      'Thank you for sharing your experience.',
    );
  });

  it('shows a green Replied status and locks the sent response', () => {
    render(
      <DraftResponseEditor replyStatus="replied" defaultMessage="This reply was sent already." />,
    );

    const status = screen.getByRole('status', { name: 'Reply status: Replied' });
    expect(status).toHaveTextContent('Replied');
    expect(status).toHaveClass('bg-status-success/10');
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue(
      'This reply was sent already.',
    );
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Send Email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
  });

  it('shows a red Not replied yet status while keeping the draft editable', () => {
    render(
      <DraftResponseEditor
        replyStatus="not_replied"
        defaultMessage="This is still a draft."
        onSend={vi.fn()}
      />,
    );

    const status = screen.getByRole('status', { name: 'Reply status: Not replied yet' });
    expect(status).toHaveTextContent('Not replied yet');
    expect(status).toHaveClass('bg-status-danger/10');
    expect(screen.getByPlaceholderText('Type your reply here...')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send Email' })).toBeEnabled();
  });

  it('disables voice input and sending while transcription is active', () => {
    mockedUseDictation.mockReturnValue({
      status: 'finishing',
      isSupported: true,
      displayText: '',
      interimText: '',
      error: null,
      toggle,
      stop: vi.fn<() => Promise<void>>(),
    });

    render(<DraftResponseEditor onSend={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Adding your words' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send Email' })).toBeDisabled();
  });

  it('keeps Send Email disabled when the editor has no send handler', () => {
    render(<DraftResponseEditor />);

    act(() => {
      capturedOnChange?.('Draft only');
    });

    expect(screen.getByRole('button', { name: 'Send Email' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('Draft only');
  });

  it('keeps the microphone visible but disabled when voice input is not part of the scope', () => {
    render(<DraftResponseEditor enableVoiceInput={false} />);

    expect(screen.getByRole('button', { name: 'Speak instead of typing' })).toBeDisabled();
  });

  it('awaits an async send and clears the draft only after success', async () => {
    let resolveSend: (() => void) | undefined;
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    render(<DraftResponseEditor onSend={onSend} />);

    fireEvent.change(screen.getByPlaceholderText('Type your reply here...'), {
      target: { value: 'Async reply' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

    expect(onSend).toHaveBeenCalledWith('Async reply');
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('Async reply');
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    await act(async () => {
      resolveSend?.();
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('');
    });
  });

  it('keeps the draft and reports an async send failure', async () => {
    const onSendError = vi.fn();
    const onSend = vi.fn().mockRejectedValue(new Error('Reply failed'));
    render(<DraftResponseEditor onSend={onSend} onSendError={onSendError} />);

    fireEvent.change(screen.getByPlaceholderText('Type your reply here...'), {
      target: { value: 'Keep this draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

    await waitFor(() => expect(onSendError).toHaveBeenCalledWith(expect.any(Error)));
    expect(screen.getByPlaceholderText('Type your reply here...')).toHaveValue('Keep this draft');
  });
});

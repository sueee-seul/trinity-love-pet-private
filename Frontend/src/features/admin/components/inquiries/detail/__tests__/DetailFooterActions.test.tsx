import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DetailFooterActions } from '../DetailFooterActions';

const assigneeOptions = [{ id: 'staff-1', name: 'Alice' }];

describe('DetailFooterActions: manager-only assign control', () => {
  it('renders Assign/Reassign only for a manager', () => {
    const { rerender } = render(
      <DetailFooterActions
        isManager
        isClosed={false}
        assignee={null}
        assigneeOptions={assigneeOptions}
        onAssigneeChange={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();

    rerender(
      <DetailFooterActions
        isManager={false}
        isClosed={false}
        assignee={null}
        assigneeOptions={assigneeOptions}
        onAssigneeChange={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
  });

  it('labels the button "Reassign" once an assignee exists', () => {
    render(
      <DetailFooterActions
        isManager
        isClosed={false}
        assignee={{ id: 'staff-1', name: 'Alice' }}
        assigneeOptions={assigneeOptions}
        onAssigneeChange={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeInTheDocument();
  });
});

describe('DetailFooterActions: closed conversations', () => {
  it('hides the Close Conversation control entirely once closed', () => {
    render(
      <DetailFooterActions
        isManager
        isClosed
        assignee={null}
        assigneeOptions={assigneeOptions}
        onAssigneeChange={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Close Conversation/ })).not.toBeInTheDocument();
  });
});

describe('DetailFooterActions: confirm-to-close flow', () => {
  const renderOpen = (
    onCloseConversation = vi.fn(),
  ): { onCloseConversation: typeof onCloseConversation } => {
    render(
      <DetailFooterActions
        isManager={false}
        isClosed={false}
        assignee={null}
        assigneeOptions={assigneeOptions}
        onAssigneeChange={vi.fn()}
        onCloseConversation={onCloseConversation}
      />,
    );
    return { onCloseConversation };
  };

  it('reveals the confirm box instead of closing immediately', async () => {
    const user = userEvent.setup();
    const { onCloseConversation } = renderOpen();

    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));

    expect(onCloseConversation).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('confirm')).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until the text is exactly "confirm" (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));

    const input = screen.getByPlaceholderText('confirm');
    const confirmButton = screen.getByRole('button', { name: 'Close Conversation' });

    await user.type(input, 'confir');
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'CONFIRM');
    expect(confirmButton).toBeEnabled();

    await user.clear(input);
    await user.type(input, '  Confirm  ');
    expect(confirmButton).toBeEnabled();
  });

  it('confirming calls onCloseConversation exactly once and resets the box', async () => {
    const user = userEvent.setup();
    const { onCloseConversation } = renderOpen();
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));

    await user.type(screen.getByPlaceholderText('confirm'), 'confirm');
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));

    expect(onCloseConversation).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText('confirm')).not.toBeInTheDocument();
  });

  it('Cancel backs out without closing and clears the typed text', async () => {
    const user = userEvent.setup();
    const { onCloseConversation } = renderOpen();
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));
    await user.type(screen.getByPlaceholderText('confirm'), 'confirm');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCloseConversation).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('confirm')).not.toBeInTheDocument();

    // Reopening should not remember the previous text.
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));
    expect(screen.getByPlaceholderText('confirm')).toHaveValue('');
  });

  it('Escape backs out without closing', async () => {
    const user = userEvent.setup();
    const { onCloseConversation } = renderOpen();
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));
    const input = screen.getByPlaceholderText('confirm');
    await user.type(input, 'confirm');

    await user.type(input, '{Escape}');

    expect(onCloseConversation).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('confirm')).not.toBeInTheDocument();
  });

  it('Enter confirms only once the text is confirmed', async () => {
    const user = userEvent.setup();
    const { onCloseConversation } = renderOpen();
    await user.click(screen.getByRole('button', { name: 'Close Conversation' }));
    const input = screen.getByPlaceholderText('confirm');

    await user.type(input, 'not yet{Enter}');
    expect(onCloseConversation).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'confirm{Enter}');
    expect(onCloseConversation).toHaveBeenCalledTimes(1);
  });
});

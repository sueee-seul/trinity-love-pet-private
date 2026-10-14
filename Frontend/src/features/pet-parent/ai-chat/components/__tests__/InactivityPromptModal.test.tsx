import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InactivityPromptModal } from '../InactivityPromptModal';

describe('InactivityPromptModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <InactivityPromptModal
        isOpen={false}
        onContinueWithAi={vi.fn()}
        onContactSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the prompt content when isOpen is true', () => {
    render(
      <InactivityPromptModal
        isOpen
        onContinueWithAi={vi.fn()}
        onContactSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.getByText('Do you still need help?')).toBeInTheDocument();
  });

  it('calls onContinueWithAi when "Continue with AI" is clicked', async () => {
    const user = userEvent.setup();
    const onContinueWithAi = vi.fn();
    render(
      <InactivityPromptModal
        isOpen
        onContinueWithAi={onContinueWithAi}
        onContactSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue with AI' }));
    expect(onContinueWithAi).toHaveBeenCalledTimes(1);
  });

  it('calls onContactSupport when "Contact Customer Support" is clicked', async () => {
    const user = userEvent.setup();
    const onContactSupport = vi.fn();
    render(
      <InactivityPromptModal
        isOpen
        onContinueWithAi={vi.fn()}
        onContactSupport={onContactSupport}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Contact Customer Support' }));
    expect(onContactSupport).toHaveBeenCalledTimes(1);
  });

  it('calls onCloseConversation when the close option is clicked', async () => {
    const user = userEvent.setup();
    const onCloseConversation = vi.fn();
    render(
      <InactivityPromptModal
        isOpen
        onContinueWithAi={vi.fn()}
        onContactSupport={vi.fn()}
        onCloseConversation={onCloseConversation}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Close conversation/ }));
    expect(onCloseConversation).toHaveBeenCalledTimes(1);
  });
});

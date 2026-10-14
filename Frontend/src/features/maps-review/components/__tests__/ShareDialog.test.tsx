import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from '../ShareDialog';

const shareTarget = {
  url: 'https://reviews.test/maps/place/PetHouse?review=review-1',
  title: "Maya Chen's review of PetHouse",
};

const writeText = vi.fn();
const originalClipboard = navigator.clipboard;

/**
 * userEvent.setup installs its own clipboard stub, so the mock has to replace it afterwards or
 * the dialog would write to the stub instead.
 */
const setupUser = (): ReturnType<typeof userEvent.setup> => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return user;
};

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
  });
});

describe('ShareDialog', () => {
  it('renders nothing while no review is being shared', () => {
    render(<ShareDialog target={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the shared link and copies it to the clipboard', async () => {
    const user = setupUser();
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Link to share' })).toHaveValue(shareTarget.url);

    await user.click(screen.getByRole('button', { name: 'COPY LINK' }));

    expect(writeText).toHaveBeenCalledWith(shareTarget.url);
    expect(screen.getByRole('button', { name: 'LINK COPIED' })).toBeInTheDocument();
  });

  it('reports a blocked clipboard instead of showing a false confirmation', async () => {
    const user = setupUser();
    writeText.mockRejectedValue(new Error('clipboard blocked'));
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'COPY LINK' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Link could not be copied');
    expect(screen.getByRole('button', { name: 'COPY LINK' })).toBeInTheDocument();
  });

  it('drops the copied confirmation when a different review is shared', async () => {
    const user = setupUser();
    const { rerender } = render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'COPY LINK' }));
    expect(screen.getByRole('button', { name: 'LINK COPIED' })).toBeInTheDocument();

    rerender(
      <ShareDialog
        target={{ url: 'https://reviews.test/maps/place/PetHouse?review=review-2', title: 'Other' }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'COPY LINK' })).toBeInTheDocument();
  });

  it('points every channel at the shared link', () => {
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    const encodedUrl = encodeURIComponent(shareTarget.url);
    expect(screen.getByRole('link', { name: 'Share on Facebook' })).toHaveAttribute(
      'href',
      `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    );
    expect(screen.getByRole('link', { name: 'Share on X' })).toHaveAttribute(
      'href',
      `https://x.com/intent/post?url=${encodedUrl}&text=${encodeURIComponent(shareTarget.title)}`,
    );
    expect(screen.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`${shareTarget.title} ${shareTarget.url}`)}`,
    );
    expect(screen.getByRole('link', { name: 'Share by email' })).toHaveAttribute(
      'href',
      `mailto:?subject=${encodeURIComponent(shareTarget.title)}&body=${encodedUrl}`,
    );
  });

  it('opens the web channels in a new tab and leaves email in place', () => {
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    for (const name of ['Share on Facebook', 'Share on X', 'Share on WhatsApp']) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('target', '_blank');
    }
    expect(screen.getByRole('link', { name: 'Share by email' })).not.toHaveAttribute('target');
  });

  it('announces a successful copy in a live region of its own', async () => {
    const user = setupUser();
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await user.click(screen.getByRole('button', { name: 'COPY LINK' }));

    expect(screen.getByRole('status')).toHaveTextContent('Link copied to the clipboard.');
    expect(screen.getByRole('button', { name: 'LINK COPIED' })).not.toHaveAttribute('aria-live');
  });

  it('takes focus into the dialog and hands it back to the opener on close', () => {
    const ShareHarness = ({ isOpen }: { isOpen: boolean }): React.ReactElement => (
      <>
        <button type="button">Share Maya Chen&apos;s review</button>
        <ShareDialog target={isOpen ? shareTarget : null} onClose={vi.fn()} />
      </>
    );
    const { rerender } = render(<ShareHarness isOpen={false} />);
    const opener = screen.getByRole('button', { name: "Share Maya Chen's review" });
    opener.focus();

    rerender(<ShareHarness isOpen />);
    expect(screen.getByRole('dialog', { name: 'Share' })).toHaveFocus();

    rerender(<ShareHarness isOpen={false} />);
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside the dialog in both directions', async () => {
    const user = setupUser();
    render(<ShareDialog target={shareTarget} onClose={vi.fn()} />);

    const closeButton = screen.getByRole('button', { name: 'Close share dialog' });
    const copyButton = screen.getByRole('button', { name: 'COPY LINK' });

    copyButton.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(copyButton).toHaveFocus();
  });

  it('closes from the close button, the backdrop and the Escape key', async () => {
    const user = setupUser();
    const onClose = vi.fn();
    render(<ShareDialog target={shareTarget} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('share-dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the dialog open when the dialog surface itself is clicked', async () => {
    const user = setupUser();
    const onClose = vi.fn();
    render(<ShareDialog target={shareTarget} onClose={onClose} />);

    await user.click(screen.getByRole('dialog', { name: 'Share' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});

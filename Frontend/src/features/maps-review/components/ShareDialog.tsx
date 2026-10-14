import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ShareTarget } from '../types/reviewTypes';
import { ReviewIcon } from './ReviewIcon';
import { SHARE_CHANNELS } from './shareChannels';

interface ShareDialogProps {
  /** The link being shared. A null target keeps the dialog closed. */
  target: ShareTarget | null;
  onClose: () => void;
}

const COPY_FAILED_MESSAGE = 'Link could not be copied. Select it and copy manually.';
const COPY_SUCCEEDED_MESSAGE = 'Link copied to the clipboard.';
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input';

/** The outcome of the last copy, remembered against the link it was made for. */
interface CopyState {
  url: string;
  status: 'copied' | 'failed';
}

/**
 * The Google Maps share dialog for a single review.
 *
 * @remarks
 * Sharing never leaves the page: copying writes to the clipboard, and each channel button opens
 * that network's own compose screen. Nothing is sent to a server from here.
 */
export const ShareDialog: React.FC<ShareDialogProps> = ({ target, onClose }) => {
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = target?.url;
  // Tying the outcome to its link is what keeps the previous review's confirmation from
  // showing when a different review is shared.
  const copyStatus = copyState?.url === shareUrl ? copyState?.status : undefined;

  useEffect(() => {
    if (!target) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return (): void => document.removeEventListener('keydown', handleEscape);
  }, [onClose, target]);

  // A modal dialog owns the focus while it is open, and hands it back on close so a keyboard
  // visitor returns to the Share button they came from instead of the top of the page.
  useEffect(() => {
    if (!target) {
      return;
    }

    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    return (): void => {
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [target]);

  const keepFocusInDialog = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const leavingBackwards = event.shiftKey && (active === first || active === dialogRef.current);
    const leavingForwards = !event.shiftKey && active === last;

    if (leavingBackwards) {
      event.preventDefault();
      last.focus();
    } else if (leavingForwards) {
      event.preventDefault();
      first.focus();
    }
  };

  const copyLink = useCallback(async (): Promise<void> => {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState({ url: shareUrl, status: 'copied' });
    } catch {
      // Clipboard access is blocked in some browsers and on insecure origins. Selecting the
      // link leaves the visitor a working manual copy instead of a silent no-op.
      linkInputRef.current?.select();
      setCopyState({ url: shareUrl, status: 'failed' });
    }
  }, [shareUrl]);

  if (!target) {
    return null;
  }

  return (
    <div
      className="maps-review-modal-backdrop"
      data-testid="share-dialog-backdrop"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        id="share-dialog"
        className="maps-review-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={keepFocusInDialog}
      >
        <header className="maps-review-share-dialog__header">
          <h2 id="share-dialog-title">Share</h2>
          <button
            type="button"
            className="maps-review-modal-close maps-review-share-dialog__close"
            aria-label="Close share dialog"
            onClick={onClose}
          >
            <ReviewIcon name="close" />
          </button>
        </header>

        <div className="maps-review-share-channels" role="group" aria-label="Share options">
          {SHARE_CHANNELS.map((channel) => (
            <a
              key={channel.id}
              className={`maps-review-share-channel maps-review-share-channel--${channel.id}`}
              href={channel.buildHref(target)}
              // An email client opens in place, so only the web channels take a new tab.
              target={channel.opensInNewTab ? '_blank' : undefined}
              rel="noreferrer"
              aria-label={channel.label}
            >
              {channel.icon}
            </a>
          ))}
        </div>

        <div className="maps-review-share-link">
          <label className="maps-review-sr-only" htmlFor="share-dialog-link">
            Link to share
          </label>
          <input
            ref={linkInputRef}
            id="share-dialog-link"
            type="text"
            readOnly
            value={target.url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="maps-review-share-copy" onClick={() => void copyLink()}>
            {copyStatus === 'copied' ? 'LINK COPIED' : 'COPY LINK'}
          </button>
        </div>

        {/* The button's own label change is not announced, so the outcome gets a live region
            of its own rather than an aria-live attribute on the button. */}
        <p className="maps-review-sr-only" role="status">
          {copyStatus === 'copied' ? COPY_SUCCEEDED_MESSAGE : ''}
        </p>

        {copyStatus === 'failed' && (
          <p className="maps-review-share-error" role="alert">
            {COPY_FAILED_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
};

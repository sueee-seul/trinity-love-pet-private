import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface GoogleReviewQuickReplyProps {
  /** App-owned Google Review id forwarded to the parent API callback. */
  reviewId: string;
  /** Display name used in the dialog heading and accessible labels. */
  reviewerName: string;
  /** Parent-owned reply mutation; this component manages draft and interaction state. */
  onReply: (reviewId: string, replyBody: string) => Promise<void>;
}

interface PanelPosition {
  top: number;
  left: number;
}

const PANEL_WIDTH = 360;
const VIEWPORT_GUTTER = 16;
const PANEL_OFFSET = 8;

/**
 * Renders the employee reply control for an unreplied Google Review.
 *
 * @remarks
 * The parent owns the API mutation. This component trims the submitted body, keeps the draft and
 * shows an alert when the callback rejects, and clears/closes the dialog only after success. The
 * dialog is portaled to `document.body`, labelled by its heading and textarea label, and closes on
 * outside pointer or Escape only when it is not sending.
 */
export const GoogleReviewQuickReply: React.FC<GoogleReviewQuickReplyProps> = ({
  reviewId,
  reviewerName,
  onReply,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(PANEL_WIDTH, Math.max(0, window.innerWidth - VIEWPORT_GUTTER * 2));
    const maxLeft = Math.max(VIEWPORT_GUTTER, window.innerWidth - panelWidth - VIEWPORT_GUTTER);

    setPanelPosition({
      top: triggerRect.bottom + PANEL_OFFSET,
      left: Math.min(Math.max(triggerRect.left, VIEWPORT_GUTTER), maxLeft),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    // The body portal avoids table overflow/stacking contexts; these listeners keep it aligned
    // while open and are removed with the dialog lifecycle.
    updatePanelPosition();
    const handleViewportChange = (): void => updatePanelPosition();
    const handleDocumentPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target) &&
        !isSending
      ) {
        setIsOpen(false);
        setDraft('');
        setError(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isSending) {
        setIsOpen(false);
        setDraft('');
        setError(null);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return (): void => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSending, updatePanelPosition]);

  const handleSubmit = async (): Promise<void> => {
    const replyBody = draft.trim();
    if (!replyBody || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await onReply(reviewId, replyBody);
      setDraft('');
      setIsOpen(false);
      setError(null);
    } catch {
      setError('Failed to send reply. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex min-w-[220px] justify-end">
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(event): void => event.stopPropagation()}
        onClick={(event): void => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className="whitespace-nowrap rounded-md bg-action-dark theme-gradient-action px-3 py-2 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Reply
      </button>
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={`google-review-quick-reply-title-${reviewId}`}
            data-testid={`google-review-quick-reply-panel-${reviewId}`}
            className="fixed z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-control-border bg-surface-card shadow-lg"
            style={{ top: panelPosition.top, left: panelPosition.left }}
            onPointerDown={(event): void => event.stopPropagation()}
            onClick={(event): void => event.stopPropagation()}
          >
            <div className="p-6">
              <h2
                id={`google-review-quick-reply-title-${reviewId}`}
                className="mb-2 type-meta font-semibold text-notice-secondary"
              >
                Reply to {reviewerName}
              </h2>
              <label htmlFor={`google-review-quick-reply-${reviewId}`} className="sr-only">
                Reply to {reviewerName}
              </label>
              <textarea
                id={`google-review-quick-reply-${reviewId}`}
                value={draft}
                onChange={(event): void => setDraft(event.target.value)}
                placeholder="Type your reply here..."
                rows={3}
                disabled={isSending}
                className="w-full resize-none rounded-md border border-field-border bg-surface-card px-2 py-1 type-meta text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSending) {
                      setIsOpen(false);
                      setDraft('');
                      setError(null);
                    }
                  }}
                  disabled={isSending}
                  className="rounded-md border border-control-border bg-surface-card px-2 py-1 type-meta text-notice-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!draft.trim() || isSending}
                  className="rounded-md bg-action-dark theme-gradient-action px-2 py-1 type-meta text-on-action-dark disabled:opacity-50"
                >
                  {isSending ? 'Replying...' : 'Reply'}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-2 type-meta text-status-danger">
                  {error}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

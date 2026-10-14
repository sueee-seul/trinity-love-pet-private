import React, { useEffect, useId, useRef } from 'react';
import { CARD_TITLE, SURFACE_CARD, TEXT_BUTTON } from './conciergeStyles';

interface ConciergeDialogProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A modal built on the native <dialog>: the browser traps focus, Escape closes it, and focus
 * returns to the button that opened it. `data-a11y-surface` keeps it inside the accessibility
 * toolbar's text scaling even though the top layer sits outside #root.
 */
export const ConciergeDialog: React.FC<ConciergeDialogProps> = ({
  open,
  title,
  closeLabel,
  onClose,
  children,
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      // The button that opened the dialog may be gone (a sign-in hides it): land somewhere real.
      if (!opener.current?.isConnected) {
        document.getElementById('concierge-page-title')?.focus();
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-a11y-surface=""
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      /*
       * The veil uses the shadow tint, not the text colour: the text colour is near white on a
       * dark theme, which turned the dim into a white wash over the page.
       */
      className={`${SURFACE_CARD} m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 text-notice-primary backdrop:bg-shadow-tint/40`}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className={CARD_TITLE}>
              {title}
            </h2>
            <button type="button" onClick={onClose} className={`${TEXT_BUTTON} -mr-2`}>
              {closeLabel}
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
};

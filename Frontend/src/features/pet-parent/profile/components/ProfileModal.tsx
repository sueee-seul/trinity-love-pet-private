import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { SECTION_TITLE } from '../../components/home/homeStyles';
import { FOCUS_RING } from './ProfileUi';
import { usePortalCopy } from '../../i18n/portalLocale';
import { ACCOUNT_CHROME_COPY } from '../copy/accountCopy';

/** The dialog the account pages edit in: a bottom sheet on a phone, a centred card from `sm`. */
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}): ReactElement {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeLabel = usePortalCopy(ACCOUNT_CHROME_COPY).closeDialog;

  // Focus moves into the dialog when it opens and goes back to whatever opened it when it closes,
  // so a keyboard user is not left at the top of the page. Mount only: re-running on each render
  // would pull focus out of the field being typed in.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return (): void => opener?.focus();
  }, []);

  useEffect(() => {
    // A dialog inside this one, such as the date picker, handles its own Escape and marks it
    // handled. That Escape closes only the picker, so the form behind it keeps what was typed.
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return (): void => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    // shadow-tint, not an ink token: a scrim has to darken the page on every theme, the ink tokens
    // turn pale on the dark themes, and shadow-tint is dark in every palette (the date picker's
    // backdrop uses it too).
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-shadow-tint/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl border border-border-soft bg-surface-cream shadow-card sm:rounded-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-soft bg-surface-cream px-5 py-3">
          <h2 id={titleId} className={SECTION_TITLE}>
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-card text-notice-secondary transition-colors hover:text-notice-primary ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

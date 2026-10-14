import React, { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen || typeof document === 'undefined') return null;

  /*
   * Rendered onto `body` rather than where it is written in the tree. `z-50` only ranks a dialog
   * against its own stacking context, and any ancestor with a transform, a filter or a
   * `backdrop-filter` starts a new one - the pet parent content panel has a backdrop blur, which
   * trapped every dialog opened from those pages underneath the sticky navbar at `z-40`.
   *
   * Escaping to `body` puts the dialog in the root stacking context, where its `z-50` means what
   * it says. It changes nothing about how a dialog looks or how it is queried in tests.
   */
  return createPortal(
    /*
     * `data-a11y-surface` marks this as application content even though it no longer lives inside
     * `#root`. The accessibility overrides scope themselves to the app so they do not recolour or
     * resize the accessibility bar itself; without this marker a dialog escaping to `body` escapes
     * the reading colours and the text size with it, and a visitor on high contrast would open a
     * dialog that ignored it.
     */
    <div
      data-a11y-surface=""
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      {/*
       * A plain dim, and no blur: the page behind a dialog stays legible, which is what makes the
       * dialog read as sitting on the product rather than on a frosted sheet of it.
       *
       * The colour is literal rather than a token. `bg-notice-primary/40` looked right on the
       * default palette and inverted on every dark theme, because that token is the body text
       * colour - on Moonlight or Slate it resolves to a pale ink, so the "dim" came out as a white
       * wash over a dark page. A scrim has to be dark whatever the palette is.
       */}
      <div
        className="fixed inset-0 transition-opacity"
        style={{ backgroundColor: 'rgb(0 0 0 / 0.28)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-2xl bg-surface-card rounded-3xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>,
    document.body,
  );
};

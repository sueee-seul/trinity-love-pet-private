import React from 'react';

/** The international symbol of access, drawn inline so the toolbar needs no icon dependency. */
export const AccessibilityIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="4" r="2" />
    <path d="M12 7.5c-1.9 0-3.6-.3-5.1-.8a1.1 1.1 0 1 0-.7 2.1c1.2.4 2.5.7 3.9.9v3l-2.2 6a1.1 1.1 0 0 0 2.1.8L11.8 14h.4l1.8 5.5a1.1 1.1 0 0 0 2.1-.8l-2.2-6v-3c1.4-.2 2.7-.5 3.9-.9a1.1 1.1 0 1 0-.7-2.1c-1.5.5-3.2.8-5.1.8Z" />
  </svg>
);

import React from 'react';

interface ToolbarButtonProps {
  onClick: () => void;
  label: string;
  isPressed?: boolean;
  isDisabled?: boolean;
  /** Set on the one button that opens a panel, so its state is announced rather than only drawn. */
  ariaExpanded?: boolean;
  ariaControls?: string;
  children: React.ReactNode;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  label,
  isPressed,
  isDisabled = false,
  ariaExpanded,
  ariaControls,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isDisabled}
    aria-label={label}
    aria-pressed={isPressed}
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-3 type-button transition-colors focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${
      isPressed
        ? 'border-accent-foreground bg-theme-peach text-accent-foreground'
        : 'border-control-border/40 bg-surface-card text-notice-primary hover:bg-surface-cream'
    }`}
  >
    {children}
  </button>
);

import React from 'react';

/**
 * The toolbar's twelve control icons, drawn inline.
 *
 * Inline rather than from an icon package because the bar has to render for a signed-out visitor
 * on the login page, where a failed or slow chunk would leave unlabelled buttons - and these are
 * the controls someone who needs them reaches for first.
 *
 * `currentColor` on every stroke and fill is what makes them follow the brand theme and the
 * reading colours without a second set of files. `aria-hidden` on all of them is deliberate:
 * every icon sits inside a `ToolbarButton` that already carries the accessible name, so naming
 * the glyph as well would have a screen reader announce each control twice.
 */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-4 w-4',
  'aria-hidden': true,
};

export const PlayIcon: React.FC = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
);

export const PauseIcon: React.FC = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" />
  </svg>
);

export const StopIcon: React.FC = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M6 6h12v12H6z" />
  </svg>
);

export const PreviousIcon: React.FC = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M7 5h2.5v14H7zM19 5v14l-9-7z" />
  </svg>
);

export const NextIcon: React.FC = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M14.5 5H17v14h-2.5zM5 5l9 7-9 7z" />
  </svg>
);

export const MinusIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SpacingIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M4 5h16M4 12h16M4 19h16" />
  </svg>
);

export const PaletteIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-1.2-1-1.7-1-2.7 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" />
    <circle cx="7.5" cy="12" r="1" fill="currentColor" />
    <circle cx="10" cy="7.5" r="1" fill="currentColor" />
    <circle cx="15" cy="8" r="1" fill="currentColor" />
  </svg>
);

export const RulerIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M3 8h18v8H3z" />
    <path d="M7 8v3M11 8v3M15 8v3M19 8v3" />
  </svg>
);

export const ResetIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v4h-4" />
  </svg>
);

export const CloseIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export const GlobeIcon: React.FC = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

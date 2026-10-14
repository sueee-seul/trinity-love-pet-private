import React, { useId } from 'react';
import type { BrandTheme } from '../constants';
import { useBrandThemeStore } from '../themeStore';

/**
 * A lace trim for the bottom of a bar.
 *
 * The design package ships no lace strip, so these are authored in its vocabulary: a scalloped edge
 * at 1.4 stroke width with round caps, carrying each theme's motif as the picot that hangs below
 * the scallop. Royal reuses the draped swag from its own divider - the one ornament in the package
 * that already reads as lace - and the minimal themes get a plain scallop with no picot at all.
 *
 * Two layers per unit. The scallop body is filled in the bar's own colour so the bar looks cut into
 * scallops rather than having a strip stuck underneath it, and the outline plus picot are stroked
 * in the shell's ink. Both come from theme tokens, so the trim follows the palette - which is what
 * puts gold lace on Royal's emerald.
 */

interface LaceUnit {
  /** Tile width. */
  width: number;
  /** The filled scallop, closed back along the top so it reads as the bar's own edge. */
  body: string;
  /** The scallop outline. */
  outline: string;
  /** The motif hanging below the scallop, or null for the minimal themes. */
  picot: React.ReactNode;
}

/**
 * Tile height. The scallops are drawn deep inside this box and the bar pads by the full amount, so
 * the trim reads as a border rather than crowding the first row of the page.
 */
export const THEME_LACE_EDGE_HEIGHT = 26;

const LACE_UNITS: Record<BrandTheme, LaceUnit> = {
  simple: {
    width: 40,
    body: 'M0 0 H40 V4 Q20 22 0 4 Z',
    outline: 'M0 4 Q20 22 40 4',
    picot: <circle cx="20" cy="18.4" r="1.6" />,
  },
  'plain-light': {
    width: 34,
    body: 'M0 0 H34 V6 Q17 18 0 6 Z',
    outline: 'M0 6 Q17 18 34 6',
    picot: null,
  },
  'plain-dark': {
    width: 34,
    body: 'M0 0 H34 V6 Q17 18 0 6 Z',
    outline: 'M0 6 Q17 18 34 6',
    picot: null,
  },
  strawberry: {
    // A knot between two beads, echoing the bow the theme uses as its symbol.
    width: 46,
    body: 'M0 0 H46 V4 Q23 23 0 4 Z',
    outline: 'M0 4 Q23 23 46 4',
    picot: (
      <>
        <path d="M23 15 26 18 23 21 20 18 Z" />
        <circle cx="12" cy="15.4" r="1.2" />
        <circle cx="34" cy="15.4" r="1.2" />
      </>
    ),
  },
  'milk-cream': {
    // A small heart, the theme's symbol, below a rounder scallop than Strawberry Cream's.
    width: 44,
    body: 'M0 0 H44 V5 Q22 21 0 5 Z',
    outline: 'M0 5 Q22 21 44 5',
    picot: <path d="M22 21.6 19.4 19a1.7 1.7 0 0 1 2.6-2.2 1.7 1.7 0 0 1 2.6 2.2Z" />,
  },
  moonlight: {
    // The four-point star from the theme's divider and tile.
    width: 46,
    body: 'M0 0 H46 V4 Q23 23 0 4 Z',
    outline: 'M0 4 Q23 23 46 4',
    picot: <path d="M23 14 24.5 17.5 28 19 24.5 20.5 23 24 21.5 20.5 18 19 21.5 17.5 Z" />,
  },
  garden: {
    // A leaf on a short stem, the motif the garden divider hangs from its rule.
    width: 46,
    body: 'M0 0 H46 V4 Q23 23 0 4 Z',
    outline: 'M0 4 Q23 23 46 4',
    picot: (
      <>
        <path d="M23 14.4 Q27 17.6 23 21 Q19 17.6 23 14.4 Z" />
        <path d="M23 21 V23.6" />
      </>
    ),
  },
  royal: {
    // Double swag with a dropped diamond, taken from royal-divider.svg.
    width: 56,
    body: 'M0 0 H56 V4 Q28 24 0 4 Z',
    outline: 'M0 4 Q28 24 56 4',
    picot: (
      <>
        <path d="M5 5 Q28 20 51 5" />
        <path d="M28 16.4 31 19.6 28 22.8 25 19.6 Z" />
      </>
    ),
  },
  noir: {
    // Art deco: a crisp chevron instead of a scallop, with one gold bead under each point.
    width: 24,
    body: 'M0 0 H24 V5 L12 12 L0 5 Z',
    outline: 'M0 5 L12 12 L24 5',
    picot: <circle cx="12" cy="17" r="1.1" />,
  },
};

interface ThemeLaceEdgeProps {
  className?: string;
}

export const ThemeLaceEdge: React.FC<ThemeLaceEdgeProps> = ({ className }) => {
  const theme = useBrandThemeStore((state) => state.theme);
  const unit = LACE_UNITS[theme];
  // Several bars can carry the trim at once, and a duplicated pattern id would make one of them
  // paint with the other's geometry.
  const patternId = `theme-lace-${useId()}`;

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height={THEME_LACE_EDGE_HEIGHT}
      className={`pointer-events-none block ${className ?? ''}`}
    >
      <defs>
        <pattern
          id={patternId}
          width={unit.width}
          height={THEME_LACE_EDGE_HEIGHT}
          patternUnits="userSpaceOnUse"
        >
          {/*
           * The body takes the shell colour, falling back to the page's own deep surface when no
           * theme is set, so the scallops always match the bar they hang from.
           */}
          <path d={unit.body} style={{ fill: 'var(--brand-shell, var(--color-surface-deep))' }} />
          <g
            fill="none"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              stroke: 'var(--brand-shell-ink, var(--color-control-border))',
              opacity: 0.75,
            }}
          >
            <path d={unit.outline} />
            {unit.picot}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height={THEME_LACE_EDGE_HEIGHT} fill={`url(#${patternId})`} />
    </svg>
  );
};

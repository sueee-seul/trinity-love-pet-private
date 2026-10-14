import React from 'react';

interface ThemeDividerProps {
  /** Width and gutters, usually the page column of the section it separates. */
  className?: string;
}

/**
 * A break between page sections that only some themes draw.
 *
 * Strawberry Cream hangs a paw on it, Garden a wave and a leaf, Maison Noir a gold rule and a
 * diamond, Le Petit Palais a string of pearls and Moonlight a crescent. Every other theme hides it,
 * so the minimal themes look exactly as they did. All of the drawing is in the theme's decor
 * stylesheet; this element only gives it somewhere to go. It is decoration, so it is hidden from
 * assistive technology.
 */
export const ThemeDivider: React.FC<ThemeDividerProps> = ({ className }) => (
  <div aria-hidden="true" className={`theme-divider ${className ?? ''}`}>
    <span className="theme-divider-mark" />
  </div>
);

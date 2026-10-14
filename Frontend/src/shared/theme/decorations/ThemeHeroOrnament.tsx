import React from 'react';

/** Moonlight's stars. The decor stylesheet places each one by its order in the ornament. */
const STARS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

/**
 * The one moving detail a theme may add to a hero band: Garden's slow breathing glow and
 * Moonlight's twinkling stars. Other themes hide it.
 *
 * It sits over the picture half of the band only, never under the copy. Putting it under the copy
 * would need a stacking context on the band, and that would trap a popover opened in the band
 * under the page that follows. Hidden below 768px, where the copy runs the full width, and still
 * under reduced motion. Decoration, so hidden from assistive technology.
 *
 * The band that holds it must be positioned.
 */
export const ThemeHeroOrnament: React.FC = () => (
  <span aria-hidden="true" className="theme-hero-ornament">
    {STARS.map((star) => (
      <span key={star} className="theme-hero-star" />
    ))}
  </span>
);

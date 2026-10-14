import React from 'react';

interface ShareChannelGlyphProps {
  /** A single SVG path on a 24x24 viewBox, taken from the network's own brand mark. */
  path: string;
}

/** Draws one channel's brand mark inside the round share button. */
export const ShareChannelGlyph: React.FC<ShareChannelGlyphProps> = ({ path }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
    <path d={path} />
  </svg>
);

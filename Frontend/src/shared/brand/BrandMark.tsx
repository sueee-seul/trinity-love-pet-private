import React from 'react';

/**
 * The one Wagstay mark: the apricot paw tile. It is also the browser tab icon.
 *
 * The address carries the same version as the icon links in index.html. `/favicon.svg` once held
 * Vite's logo, and a browser keeps a tab icon by its address, so without the version a returning
 * visitor still saw the old one.
 */
export const BRAND_ICON_VERSION = 2;
export const BRAND_MARK_SRC = `/favicon.svg?v=${BRAND_ICON_VERSION}`;

/** The file's own size, so the browser reserves the space before it loads. */
const BRAND_MARK_SIZE = 64;

interface BrandMarkProps {
  /** Size and spacing utilities for the place it sits in, for example `h-9 w-9`. */
  className?: string;
}

/**
 * The Wagstay paw beside the wordmark.
 *
 * It is the same file as the tab icon and keeps its own colours in every theme and reading
 * colour: the brand never changes with the look, as the product owner decided in September
 * 2026. It is decorative, because the "Wagstay" text next to it already names the link or the
 * heading.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'h-9 w-9' }) => (
  <img
    src={BRAND_MARK_SRC}
    alt=""
    aria-hidden="true"
    width={BRAND_MARK_SIZE}
    height={BRAND_MARK_SIZE}
    decoding="async"
    className={`shrink-0 ${className}`}
  />
);

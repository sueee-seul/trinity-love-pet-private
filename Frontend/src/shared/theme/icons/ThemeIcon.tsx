import React from 'react';
import { type ThemeIconName } from './iconNames';

/**
 * The design package's 24 icons.
 *
 * It ships 96 SVG files - the same 24 shapes exported four times, each with the theme's colour
 * baked into a `style` attribute. The geometry is identical, and every file already strokes with
 * `currentColor`, so only the colour was ever different. These are the 24 shapes with the baked
 * colour dropped: the icon inherits `color` from whatever the surrounding text uses, which means it
 * follows the brand theme and the accessibility high-contrast modes without a second set of files.
 *
 * Generated from assets/icons/garden. Regenerate rather than hand-edit.
 */

const ICON_SHAPES: Record<ThemeIconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M3 12h17m-6-6 6 6-6 6" />
    </>
  ),
  bed: (
    <>
      <path d="M3 8v13m18-7v7M3 17h18M3 13h15a3 3 0 0 1 3 3" />
      <rect x="5" y="9" width="5" height="4" rx="2" />
      <path d="M12 10h5a4 4 0 0 1 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M5 10a7 7 0 0 1 14 0c0 6 3 6 3 7H2c0-1 3-1 3-7Zm5 10q2 3 4 0M12 2v1" />
    </>
  ),
  bow: (
    <>
      <path d="M10 10C0-2 0 22 10 14m4-4C24-2 24 22 14 14" />
      <rect x="9" y="9" width="6" height="6" rx="2" />
      <path d="m10 15-3 7-2-3m9-4 3 7 2-3" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 13h18a9 8 0 0 1-18 0ZM2 13h20M7 9c-2-2 2-3 0-5m5 5c-2-2 2-3 0-5m5 5c-2-2 2-3 0-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1" />
    </>
  ),
  camera: (
    <>
      <path d="m8 5 2-2h4l2 2h4a2 2 0 0 1 2 2v13H2V7a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="12" r="4" />
      <path d="M18 8h1" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11a9 9 0 0 1-9 8H7l-4 3v-7A9 9 0 1 1 21 11Z" />
      <path d="M7 10h.1m4.9 0h.1m4.9 0h.1" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L20 5M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </>
  ),
  crown: (
    <>
      <path d="m3 7 5 4 4-8 4 8 5-4-2 13H5ZM5 17h14" />
      <circle cx="12" cy="13" r="1" />
    </>
  ),
  flower: (
    <>
      <path d="M9 7C5-2 0 7 6 10c-10 1-3 11 2 6-2 10 10 7 7 0 7 5 11-6 3-6 6-6-5-12-5-3Z" />
      <circle cx="11.5" cy="12" r="3" />
    </>
  ),
  heart: (
    <>
      <path d="M12 21 3.8 13A5.8 5.8 0 0 1 12 5a5.8 5.8 0 0 1 8.2 8Z" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C8 2 2 7 5 15s18 5 15-12ZM3 21 16 8m-8 8v-5m0 5h6" />
    </>
  ),
  moon: (
    <>
      <path d="M20 15A9 9 0 1 1 9 3a8 8 0 0 0 11 12Z" />
      <path d="m17 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
    </>
  ),
  paw: (
    <>
      <ellipse cx="7" cy="7" rx="2" ry="3" />
      <ellipse cx="17" cy="7" rx="2" ry="3" />
      <ellipse cx="3.5" cy="12" rx="1.5" ry="2.5" />
      <ellipse cx="20.5" cy="12" rx="1.5" ry="2.5" />
      <path d="M6 18c0-3 4-7 6-7s6 4 6 7c0 4-4 2-6 2s-6 2-6-2Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 7 7" />
    </>
  ),
  settings: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="8" cy="6" r="2" fill="var(--surface,white)" />
      <circle cx="16" cy="12" r="2" fill="var(--surface,white)" />
      <circle cx="10" cy="18" r="2" fill="var(--surface,white)" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  star: (
    <>
      <path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M20 4l-2 2M6 18l-2 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0Z" />
    </>
  ),
  walk: (
    <>
      <path d="M15 4c6-3 9 3 4 6l-5 2-3 9M6 6c-5-1-4 6 0 5l4-3c4-3 6 1 4 4M7 21h8" />
      <circle cx="11" cy="4" r="2" />
    </>
  ),
};

interface ThemeIconProps {
  name: ThemeIconName;
  /**
   * Announce the icon with this name. Left off, the icon is hidden from assistive technology,
   * which is correct whenever it sits beside text that already says the same thing.
   */
  label?: string;
  className?: string;
}

export const ThemeIcon: React.FC<ThemeIconProps> = ({ name, label, className }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
  >
    {ICON_SHAPES[name]}
  </svg>
);

import React from 'react';

/**
 * The design package's puppy and kitten avatars.
 *
 * Named `ThemePetAvatar` because `ProfileUi` already exports a `PetAvatar`, and a second one would
 * make every import a guess about which one was meant.
 *
 * These stay at their original colours. They are multi-colour illustrations rather than line art,
 * so there is no single `currentColor` to hand them, and recolouring the fur per theme would make
 * the animals change species-colour with the palette. They read as illustration on every theme's
 * card surface.
 *
 * Both are given a real `role="img"` and name: unlike the hero, an avatar is often the only thing
 * identifying which pet a row is about.
 */

const FACE = (
  <>
    <ellipse cx="60" cy="65" rx="36" ry="34" fill="#fff8e8" />
    <ellipse cx="47" cy="62" rx="3.5" ry="5" fill="#49382f" />
    <ellipse cx="73" cy="62" rx="3.5" ry="5" fill="#49382f" />
    <ellipse cx="60" cy="75" rx="6" ry="4" fill="#76503f" />
    <path
      d="M60 79v3m0 0q-6 7-10 0m10 0q6 7 10 0"
      fill="none"
      stroke="#76503f"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <ellipse cx="37" cy="74" rx="7" ry="4" fill="#eaaea1" />
    <ellipse cx="83" cy="74" rx="7" ry="4" fill="#eaaea1" />
    <path d="m60 102-15-8v15Zm0 0 15-8v15Z" fill="#b97483" />
    <circle cx="60" cy="102" r="4" fill="#b97483" />
  </>
);

interface ThemePetAvatarProps {
  species: 'puppy' | 'kitten';
  /** Left off, the avatar is announced by species alone. */
  label?: string;
  className?: string;
}

export const ThemePetAvatar: React.FC<ThemePetAvatarProps> = ({ species, label, className }) => (
  <svg
    viewBox="0 0 120 120"
    width="120"
    height="120"
    role="img"
    aria-label={label ?? (species === 'puppy' ? 'Puppy avatar' : 'Kitten avatar')}
    className={className}
  >
    <circle cx="60" cy="60" r="55" fill="#f3e4ce" />
    {species === 'puppy' ? (
      <>
        <ellipse cx="26" cy="64" rx="16" ry="27" fill="#b87845" transform="rotate(15 26 64)" />
        <ellipse cx="94" cy="64" rx="16" ry="27" fill="#b87845" transform="rotate(-15 94 64)" />
      </>
    ) : (
      <path d="m25 54-3-33 29 20m19 0 29-20-4 35" fill="#fff9ed" stroke="#bda98e" strokeWidth="2" />
    )}
    {FACE}
  </svg>
);

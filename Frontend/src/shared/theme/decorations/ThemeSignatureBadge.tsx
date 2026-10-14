import React from 'react';
import type { BrandTheme } from '../constants';
import { ThemeIcon } from '../icons/ThemeIcon';
import type { ThemeIconName } from '../icons/iconNames';
import { useBrandThemeStore } from '../themeStore';

/**
 * The themes that pin their own motif to the top package: Strawberry Cream's bow and Le Petit
 * Palais's crown. Any other theme shows nothing.
 */
const SIGNATURE_BADGES: Partial<Record<BrandTheme, ThemeIconName>> = {
  strawberry: 'bow',
  royal: 'crown',
};

/**
 * A small round badge for the corner of the Signature package card.
 *
 * Decoration only: the card already names its tier, so the badge is hidden from assistive
 * technology. The card that holds it must be positioned; the decor stylesheet does that for
 * `.theme-key-card` in the themes that draw on it.
 */
export const ThemeSignatureBadge: React.FC = () => {
  const theme = useBrandThemeStore((state) => state.theme);
  const icon = SIGNATURE_BADGES[theme];

  if (!icon) {
    return null;
  }

  return (
    <span aria-hidden="true" className="theme-signature-badge">
      <ThemeIcon name={icon} className="h-5 w-5" />
    </span>
  );
};

import React from 'react';
import { THEME_PAGE_IMAGES } from '../assets/pageImages';
import { BRAND_THEME_DETAILS, isNightModeTheme, type BrandTheme } from '../constants';
import { ThemeIcon } from '../icons/ThemeIcon';
import type { ThemeIconName } from '../icons/iconNames';
import { useSiteCopy, type SiteCopy } from '../../i18n/siteLanguage';

export interface ThemeCardTagLabels {
  /** On the look a visitor sees before choosing one. */
  defaultLook: string;
  nightMode: string;
}

interface ThemeCardProps {
  theme: BrandTheme;
  name: string;
  /** The `name` all the cards of one picker share, so they form one radio group. */
  radioName: string;
  /** Whether this is the page's default look; the landing page and a staff page differ. */
  isDefault: boolean;
  tagLabels: ThemeCardTagLabels;
  checked: boolean;
  onChoose: (theme: BrandTheme) => void;
}

interface ThemeCardTag {
  icon: ThemeIconName;
  label: string;
}

/** The type sample a minimal theme shows in place of a picture, in the page's script. */
const FONT_SAMPLE: SiteCopy<string> = { en: 'Aa', zh: '字' };

/** The tags a card carries, in reading order. */
const tagsFor = (
  theme: BrandTheme,
  isDefault: boolean,
  labels: ThemeCardTagLabels,
): ThemeCardTag[] => [
  ...(isDefault ? [{ icon: 'star' as const, label: labels.defaultLook }] : []),
  ...(isNightModeTheme(theme) ? [{ icon: 'moon' as const, label: labels.nightMode }] : []),
];

/**
 * One look in a theme picker: a native radio inside a card. The landing page and Account Settings
 * both use it, so a theme looks the same wherever it is chosen.
 *
 * A romantic or luxury theme shows its own picture. A minimal theme has no picture, so it shows
 * its page colour with "Aa" in its accent: the plain look it promises. The pictures load lazily,
 * only when the picker comes near the screen (see docs/landing-page.md).
 *
 * The tags sit inside the label, so a screen reader hears them with the theme's name.
 */
export const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  name,
  radioName,
  isDefault,
  tagLabels,
  checked,
  onChoose,
}) => {
  const picture = THEME_PAGE_IMAGES[theme];
  const fontSample = useSiteCopy(FONT_SAMPLE);
  const [pageColour, accentColour] = BRAND_THEME_DETAILS[theme].swatches;
  const tags = tagsFor(theme, isDefault, tagLabels);

  return (
    <label className="relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-[22px] border border-border-soft bg-surface-card p-2 transition-[border-color,transform] duration-200 ease-out hover:border-control-border has-[:checked]:border-accent-foreground has-[:checked]:ring-1 has-[:checked]:ring-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100">
      <input
        type="radio"
        name={radioName}
        value={theme}
        checked={checked}
        onChange={() => onChoose(theme)}
        className="sr-only"
      />
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[16px] bg-surface-cream">
        {picture === null ? (
          // Literal swatch colours, not theme tokens: this previews a palette the page may not be
          // wearing, so it must not follow the active theme.
          <span
            aria-hidden="true"
            style={{ backgroundColor: pageColour, color: accentColour }}
            className="flex h-full w-full items-center justify-center rounded-[16px] border border-black/10 font-inter text-[22px] font-semibold"
          >
            {fontSample}
          </span>
        ) : (
          <img
            src={picture}
            alt=""
            loading="lazy"
            decoding="async"
            className="block h-full w-full object-cover object-right"
          />
        )}
        {tags.length > 0 && (
          <span className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.icon}
                className="inline-flex items-center gap-1 rounded-full bg-surface-card/90 px-2 py-0.5 font-inter text-[12px] leading-4 text-notice-primary"
              >
                <ThemeIcon name={tag.icon} className="h-3.5 w-3.5 shrink-0" />
                {tag.label}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="flex min-h-9 items-center justify-between gap-2 px-1.5 pb-1">
        <span className="min-w-0 font-inter text-[14px] leading-5 text-notice-primary">{name}</span>
        {checked && <ThemeIcon name="check" className="h-5 w-5 shrink-0 text-accent-foreground" />}
      </span>
    </label>
  );
};

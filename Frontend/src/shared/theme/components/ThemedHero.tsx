import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { THEME_COPY } from '../themeCopy';
import { useBrandThemeStore } from '../themeStore';

interface ThemedHeroProps {
  /** The copy that sits in the picture's left-hand text space. */
  children: React.ReactNode;
  className?: string;
}

/**
 * The current theme's picture on its hero colour, with the copy laid over the picture's empty
 * side. A minimal theme has no picture (`--theme-page-image` is `none`), so for it this is a plain
 * panel in the hero colour.
 *
 * The picture comes from `--theme-page-image` through `.bg-theme-image`, not from an `<img>`. The
 * reading colours set that property to `none`, and a CSS background is the only way they can
 * take the picture away: their flattening rule skips `<img>` on purpose, and this component also
 * renders in the toolbar panel, which is outside `#root`.
 *
 * Every picture keeps its animals on the right and leaves room for words on the left, so the
 * picture is anchored right and a gradient in the hero colour sits under the text. On wider
 * screens the gradient runs left to right beside the copy. On phones the copy takes the full
 * width, so the picture gets room below it and the gradient runs top to bottom instead.
 */
export const ThemedHero: React.FC<ThemedHeroProps> = ({ children, className }) => {
  const theme = useBrandThemeStore((state) => state.theme);
  const { blurbs } = useSiteCopy(THEME_COPY);

  return (
    <section
      className={`relative isolate overflow-hidden rounded-[15px] bg-hero text-hero-ink ${className ?? ''}`}
    >
      {/* Decorative: the picture repeats what the copy already says. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-theme-image bg-right"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-hero from-50% to-transparent sm:bg-gradient-to-r sm:from-40% sm:to-80%"
      />

      {/* The caption says what the theme is; the copy above it names it. */}
      <div className="relative max-w-prose p-5 pb-24 sm:w-1/2 sm:p-6 sm:min-h-[9rem]">
        {children}
        <p className="mt-2 mb-0 type-meta text-hero-ink/80">{blurbs[theme]}</p>
      </div>
    </section>
  );
};

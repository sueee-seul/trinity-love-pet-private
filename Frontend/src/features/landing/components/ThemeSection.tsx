import React from 'react';
import {
  BRAND_THEME_FAMILIES,
  CUSTOMER_DEFAULT_BRAND_THEME,
  ThemeCard,
  ThemeIcon,
  themesInFamily,
} from '../../../shared/theme';
import type { LandingCopy } from '../copy';
import { useThemeChoice } from '../hooks/useThemeChoice';
import { BODY, LEAD, PAGE_COLUMN, SECTION, SECTION_TITLE } from './landingStyles';

/** The one theme radio group on the page. */
const LANDING_THEME_RADIO = 'landing-theme';

interface ThemeSectionProps {
  copy: LandingCopy;
}

/**
 * The page's one memorable moment: pick a look and the whole site changes with it, right here.
 *
 * The looks are grouped as romantic, luxury and minimal, in that order. Every card is a radio in
 * one native group, so arrow keys move across all nine looks, from one group into the next.
 */
export const ThemeSection: React.FC<ThemeSectionProps> = ({ copy }) => {
  const { themes } = copy;
  const { theme, chooseTheme } = useThemeChoice();

  return (
    <section aria-labelledby="landing-themes-title" className={SECTION}>
      <div className={PAGE_COLUMN}>
        <div className="flex flex-col gap-4">
          <h2 id="landing-themes-title" className={SECTION_TITLE}>
            {themes.title}
          </h2>
          <p className={LEAD}>{themes.lead}</p>
        </div>
        <fieldset className="m-0 mt-10 flex min-w-0 flex-col gap-8 border-0 p-0">
          <legend className="sr-only">{themes.legend}</legend>
          {BRAND_THEME_FAMILIES.map((family) => (
            <div key={family} className="flex flex-col gap-3">
              <h3 className="m-0 font-inter text-[15px] leading-5 font-semibold text-notice-secondary">
                {themes.families[family]}
              </h3>
              {/* The same columns in every group, so a card is the same size in each one. */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
                {themesInFamily(family).map((option) => (
                  <ThemeCard
                    key={option}
                    theme={option}
                    name={themes.names[option]}
                    radioName={LANDING_THEME_RADIO}
                    // The landing page is a customer page, so its default is the customer one.
                    isDefault={option === CUSTOMER_DEFAULT_BRAND_THEME}
                    tagLabels={themes.tags}
                    checked={option === theme}
                    onChoose={chooseTheme}
                  />
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <p className={`${BODY} mt-8 flex max-w-[70ch] items-start gap-3`}>
          <ThemeIcon name="settings" className="mt-0.5 h-6 w-6 shrink-0 text-notice-secondary" />
          <span className="min-w-0">{themes.helpLine}</span>
        </p>
      </div>
    </section>
  );
};

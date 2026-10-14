import React, { useId } from 'react';
import { BRAND_THEME_FAMILIES, themesInFamily, type BrandTheme } from '../constants';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { useAccessibilityStore } from '../../accessibility/store/accessibilityStore';
import { defaultThemeForPath } from '../themeDefaults';
import { useBrandThemeStore } from '../themeStore';
import { THEME_COPY } from '../themeCopy';
import { ThemeCard } from './ThemeCard';
import { ThemedHero } from './ThemedHero';

/**
 * Account Settings control for the app's palette.
 *
 * This is a look-and-feel choice, which is why every theme lives here rather than in the
 * accessibility toolbar. That bar has one Theme control, which either links to this page or opens
 * an appearance panel rendering this same component. The reading colour modes beside it are a
 * different thing - reading aids - and the two are mutually exclusive: one appearance at a time,
 * whichever control was used last.
 *
 * The preview shows the chosen theme on its hero colour, named once with a line about it. Below
 * it the themes are in their three groups, in the order every picker uses (romantic, luxury,
 * minimal), as the same picture cards the landing page uses. The groups are rows, not columns:
 * as columns in a dialog the names and blurbs broke a word to a line. The cards come four to a
 * row where the picker has room and two where it does not, such as the toolbar's panel, which is
 * why the grid follows the picker's own width rather than the window's.
 */
export const ThemeSettingsPicker: React.FC = () => {
  const theme = useBrandThemeStore((state) => state.theme);
  const setTheme = useBrandThemeStore((state) => state.setTheme);
  const setContrastTheme = useAccessibilityStore((state) => state.setContrastTheme);
  const copy = useSiteCopy(THEME_COPY);

  /**
   * Choosing a theme also clears the reading colour.
   *
   * A reading colour flattens every surface to one pair of colours with `!important`, so with one
   * active a theme could be picked and nothing on screen would move. The choice looked broken,
   * and the only way out was to know you had to switch the reading colour off first.
   *
   * One appearance at a time, and whichever control was used last is the one that wins. The
   * reverse already worked: a reading colour overrides the theme.
   */
  const chooseTheme = (option: BrandTheme): void => {
    setContrastTheme('default');
    setTheme(option);
  };

  // Generated, not constants: this renders in Account Settings and in the toolbar's appearance
  // panel, and a pet parent can have both open at once. A fixed id or radio name would be in the
  // document twice, and the two pickers would share one radio group.
  const descriptionId = useId();
  const radioName = useId();

  // Staff pages under /admin open in Simple and customer pages in Strawberry Cream, so the tag
  // names the default of the page this picker is on. The location is read directly, not through
  // the router, so the picker keeps working in the toolbar panel as well as in Account Settings.
  const defaultTheme = defaultThemeForPath(window.location.pathname);

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-cream/40 p-4 sm:p-5">
      <p className="type-body font-semibold">{copy.picker.title}</p>
      <p id={descriptionId} className="mt-1 mb-0 type-meta">
        {copy.picker.description}
      </p>

      {/* Text on the hero takes the hero ink: Royal's hero is emerald, so body ink would vanish. */}
      <ThemedHero className="mt-4">
        <p className="mb-0 type-eyebrow text-hero-ink/80">{copy.picker.preview}</p>
        <h3 className="mt-1 mb-0 text-hero-ink">{copy.names[theme]}</h3>
      </ThemedHero>

      <fieldset
        aria-describedby={descriptionId}
        className="@container m-0 mt-5 flex min-w-0 flex-col gap-5 border-0 p-0"
      >
        <legend className="sr-only">{copy.picker.legend}</legend>
        {BRAND_THEME_FAMILIES.map((family) => (
          <section
            key={family}
            aria-label={copy.families[family]}
            className="flex flex-col gap-2.5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <p className="m-0 type-eyebrow text-notice-muted">{copy.families[family]}</p>
              <p className="m-0 type-meta text-notice-secondary">{copy.familyBlurbs[family]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 @md:grid-cols-4">
              {themesInFamily(family).map((option) => (
                <ThemeCard
                  key={option}
                  theme={option}
                  name={copy.names[option]}
                  radioName={radioName}
                  isDefault={option === defaultTheme}
                  tagLabels={copy.tags}
                  checked={option === theme}
                  onChoose={chooseTheme}
                />
              ))}
            </div>
          </section>
        ))}
      </fieldset>
    </div>
  );
};

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeSettingsPicker } from '../components/ThemeSettingsPicker';
import { BRAND_THEMES, UNTHEMED_BRAND_THEME } from '../constants';
import { useAccessibilityStore } from '../../accessibility/store/accessibilityStore';
import { SiteLanguageContext } from '../../i18n/siteLanguage';
import { useBrandThemeStore } from '../themeStore';

describe('ThemeSettingsPicker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    useBrandThemeStore.setState({ theme: UNTHEMED_BRAND_THEME, hasChosen: false });
    useAccessibilityStore.getState().setContrastTheme('default');
  });

  /**
   * Regression: a reading colour repaints every surface with `!important`, so while one was on a
   * theme could be chosen and nothing on screen moved. The control looked broken, and the only
   * way out was knowing to switch the reading colour off first.
   */
  it('clears an active reading colour so the theme is actually visible', () => {
    useAccessibilityStore.getState().setContrastTheme('dark');
    render(<ThemeSettingsPicker />);

    fireEvent.click(screen.getByRole('radio', { name: /Moonlight Sleepover/ }));

    expect(useAccessibilityStore.getState().contrastTheme).toBe('default');
    expect(document.documentElement.dataset.theme).toBe('moonlight');
  });

  it('offers every theme as its own radio, including the original palette', () => {
    render(<ThemeSettingsPicker />);

    expect(screen.getAllByRole('radio')).toHaveLength(BRAND_THEMES.length);
    // The original palette is named "Simple"; the reading colours carry no name for it at all.
    expect(screen.getByRole('radio', { name: /Simple/ })).toBeChecked();
  });

  it('groups the themes as romantic, luxury and minimal, with minimal last', () => {
    render(<ThemeSettingsPicker />);

    const groups = within(screen.getByRole('group', { name: 'App theme' })).getAllByRole('region');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Romantic',
      'Luxury',
      'Minimal',
    ]);
    expect(within(groups[2]).getAllByRole('radio')).toHaveLength(3);
  });

  // The same picture cards as the landing page: a picture for the illustrated themes, the plain
  // "Aa" swatch for the minimal ones.
  it('shows each theme as a picture card', () => {
    render(<ThemeSettingsPicker />);

    const withPicture = screen
      .getAllByRole('radio')
      .filter((radio) => radio.closest('label')?.querySelector('img') !== null)
      .map((radio) => radio.getAttribute('value'));
    expect(withPicture).toEqual([
      'strawberry',
      'milk-cream',
      'garden',
      'moonlight',
      'royal',
      'noir',
    ]);
  });

  // Account Settings and the toolbar panel can be open together; each must be its own group.
  it('keeps two open pickers in separate radio groups', () => {
    render(
      <>
        <ThemeSettingsPicker />
        <ThemeSettingsPicker />
      </>,
    );

    const groupNames = new Set(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('name')),
    );
    expect(groupNames.size).toBe(2);
  });

  /** The labels of the cards that carry `tag`. */
  const cardsTagged = (tag: string): (string | null | undefined)[] =>
    screen
      .getAllByRole('radio')
      .map((radio) => radio.closest('label'))
      .filter((card) => card !== null && within(card).queryByText(tag) !== null)
      .map((card) => card?.textContent);

  it('tags only Moonlight Sleepover and Slate as night mode', () => {
    render(<ThemeSettingsPicker />);

    expect(cardsTagged('Night mode')).toEqual([
      expect.stringContaining('Moonlight Sleepover'),
      expect.stringContaining('Slate'),
    ]);
  });

  const defaultTagged = (): (string | null | undefined)[] => cardsTagged('Default');

  it('tags Strawberry Cream as the default on a customer page', () => {
    window.history.pushState({}, '', '/parent/settings');
    render(<ThemeSettingsPicker />);

    expect(defaultTagged()).toEqual([expect.stringContaining('Strawberry Cream')]);
  });

  // Staff pages open in the same theme as customer pages, so the tag points at it there too.
  it('tags Strawberry Cream as the default on a staff page', () => {
    window.history.pushState({}, '', '/admin/settings');
    render(<ThemeSettingsPicker />);

    expect(defaultTagged()).toEqual([expect.stringContaining('Strawberry Cream')]);
    window.history.pushState({}, '', '/');
  });

  it('applies a theme to the document when its option is chosen', () => {
    render(<ThemeSettingsPicker />);

    fireEvent.click(screen.getByRole('radio', { name: /Le Petit Palais/ }));

    expect(document.documentElement.dataset.theme).toBe('royal');
    expect(screen.getByRole('radio', { name: /Le Petit Palais/ })).toBeChecked();
  });

  it('speaks Chinese when the page is in Chinese', () => {
    window.history.pushState({}, '', '/parent/settings');
    render(
      <SiteLanguageContext.Provider value="zh">
        <ThemeSettingsPicker />
      </SiteLanguageContext.Provider>,
    );

    const groups = within(screen.getByRole('group', { name: '网站主题' })).getAllByRole('region');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      '浪漫',
      '奢华',
      '极简',
    ]);
    expect(screen.getByRole('radio', { name: /草莓奶油/ })).toHaveAccessibleName(/默认/);
    expect(screen.getByText('预览')).toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });
});

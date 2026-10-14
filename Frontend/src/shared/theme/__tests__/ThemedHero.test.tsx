import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemedHero } from '../components/ThemedHero';
import { SiteLanguageContext } from '../../i18n/siteLanguage';
import { BRAND_THEMES, UNTHEMED_BRAND_THEME } from '../constants';
import { THEME_COPY } from '../themeCopy';
import { useBrandThemeStore } from '../themeStore';

const renderHero = (): HTMLElement => {
  const { container } = render(
    <ThemedHero>
      <h3>Welcome back</h3>
    </ThemedHero>,
  );
  const section = container.querySelector('section');
  if (section === null) {
    throw new Error('ThemedHero rendered no section');
  }
  return section;
};

describe('ThemedHero', () => {
  beforeEach(() => {
    useBrandThemeStore.setState({ theme: UNTHEMED_BRAND_THEME });
  });

  // The layer is there in every theme. A minimal theme sets `--theme-page-image` to `none`, so the
  // same layer paints nothing and the reading colours keep one rule to switch pictures off.
  // The caption describes the theme; the copy passed in names it, so the name is not said twice.
  it('shows the picture layer, the copy and the theme blurb for every theme', () => {
    BRAND_THEMES.forEach((theme) => {
      useBrandThemeStore.setState({ theme });
      const section = renderHero();

      expect(section.querySelector('.bg-theme-image'), theme).not.toBeNull();
      expect(section).toHaveTextContent('Welcome back');
      expect(section).toHaveTextContent(THEME_COPY.en.blurbs[theme]);
      cleanup();
    });
  });

  it('describes the theme in Chinese when the page is in Chinese', () => {
    useBrandThemeStore.setState({ theme: 'garden' });
    render(
      <SiteLanguageContext.Provider value="zh">
        <ThemedHero>
          <h3>欢迎回来</h3>
        </ThemedHero>
      </SiteLanguageContext.Provider>,
    );

    expect(screen.getByText(THEME_COPY.zh.blurbs.garden)).toBeInTheDocument();
  });

  /**
   * The picture has to be a CSS background read from `--theme-page-image`. The reading colours
   * set that property to `none`, and their flattening rule skips `<img>` on purpose, so an image
   * element here would keep the picture on screen for a visitor who asked for none.
   */
  it('draws the picture as a background, never as an image element', () => {
    useBrandThemeStore.setState({ theme: 'plain-light' });
    const section = renderHero();

    expect(section.querySelector('img')).toBeNull();
  });

  // The picture repeats what the heading says, so announcing it would read the same thing twice.
  it('keeps the picture layers hidden from assistive technology', () => {
    const section = renderHero();

    const layers = section.querySelectorAll(':scope > div[aria-hidden="true"]');
    expect(layers).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  // Royal's hero is emerald, so the band has to carry its own ink rather than the body text colour.
  it('paints the band in the hero colour pair', () => {
    const section = renderHero();

    expect(section).toHaveClass('bg-hero', 'text-hero-ink');
  });
});

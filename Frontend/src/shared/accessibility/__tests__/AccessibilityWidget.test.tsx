import React from 'react';
import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityWidget } from '../components/AccessibilityWidget';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { UNTHEMED_BRAND_THEME } from '../../theme/constants';
import { useBrandThemeStore } from '../../theme/themeStore';
import { englishWordsIn } from '../../i18n/testing/englishWordsIn';
import { hanCharactersIn } from '../../i18n/testing/hanCharactersIn';
import { SiteLanguageContext, SiteLanguageSwitchContext } from '../../i18n/siteLanguage';

/*
 * No auth store is set up here, so every case below is a signed-out visitor - the branch that
 * opens the panel the bar owns. The pet parent branch navigates instead, and is covered in
 * `appearanceDestination.test.tsx`.
 */
const render = (ui: React.ReactElement): ReturnType<typeof rtlRender> =>
  rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const resetStore = (): void => {
  useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
};

describe('AccessibilityWidget', () => {
  beforeEach(() => {
    resetStore();
    document.documentElement.removeAttribute('data-a11y-theme');
    window.localStorage.clear();
    useBrandThemeStore.setState({ theme: UNTHEMED_BRAND_THEME, hasChosen: false });
    delete document.documentElement.dataset.theme;
  });

  // Reset puts the page back how it was: the route's own default theme, with the choice forgotten.
  it('resets a chosen theme to the default for the page it is on', () => {
    useBrandThemeStore.getState().setTheme('noir');
    rtlRender(
      <MemoryRouter initialEntries={['/admin/profile']}>
        <AccessibilityWidget />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    fireEvent.click(screen.getByRole('button', { name: 'Reset accessibility settings' }));

    expect(useBrandThemeStore.getState()).toMatchObject({ theme: 'strawberry', hasChosen: false });
    expect(document.documentElement.dataset.theme).toBe('strawberry');
  });

  // Owner rule: no Chinese character in English mode, and the switch names the other language in
  // the current one.
  it('names the language switch in the page language, with no Chinese in English mode', () => {
    const switchLanguage = vi.fn();
    render(
      <SiteLanguageSwitchContext.Provider value={switchLanguage}>
        <AccessibilityWidget />
      </SiteLanguageSwitchContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    const languageSwitch = screen.getByRole('button', { name: 'Switch to Chinese' });
    expect(languageSwitch).toHaveTextContent('Chinese');
    expect(hanCharactersIn(document.body)).toEqual([]);
    fireEvent.click(languageSwitch);
    expect(switchLanguage).toHaveBeenCalledWith('zh');
  });

  it('names English as 英文 in Chinese mode, with no English left in the bar', () => {
    render(
      <SiteLanguageContext.Provider value="zh">
        <AccessibilityWidget />
      </SiteLanguageContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    expect(screen.getByRole('button', { name: '切换到英文' })).toHaveTextContent('英文');
    expect(englishWordsIn(screen.getByTestId('accessibility-toolbar'))).toEqual([]);
  });

  it('shows the floating launcher and swaps it for the toolbar when opened', () => {
    render(<AccessibilityWidget />);

    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    expect(screen.getByTestId('accessibility-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('accessibility-launcher')).not.toBeInTheDocument();
  });

  it('renders nothing while the launcher is switched off in settings', () => {
    useAccessibilityStore.setState({ isLauncherEnabled: false });

    render(<AccessibilityWidget />);

    expect(screen.queryByTestId('accessibility-launcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accessibility-toolbar')).not.toBeInTheDocument();
  });

  it('closes the toolbar on Escape and returns focus to the launcher', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('accessibility-toolbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('accessibility-launcher')).toHaveFocus();
  });

  it('applies the text size choice to the document element', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    fireEvent.click(screen.getByLabelText('Increase text size'));

    const root = document.documentElement;
    expect(root.dataset.a11yScaled).toBe('true');
    expect(root.style.getPropertyValue('--a11y-font-scale')).toBe('1.15');
  });

  /**
   * A visitor who is not a pet parent gets the panel rather than a link. The bar is mounted on
   * every surface, and Account Settings sits behind `AccountRoute identity="pet_owner"` - so a
   * staff or manager account following that link is thrown back to `/admin`, and a signed-out
   * visitor to `/login`. Owning the panel is what keeps the control working for them.
   */
  it('opens the appearance panel in place for a visitor who is not a pet parent', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    const themeButton = screen.getByLabelText('Themes and reading colours');
    expect(themeButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(themeButton);

    expect(screen.getByTestId('accessibility-appearance-panel')).toBeInTheDocument();
    expect(themeButton).toHaveAttribute('aria-expanded', 'true');
    // Still mounted: a navigation would have unmounted the bar along with the page under it.
    expect(screen.getByTestId('accessibility-toolbar')).toBeInTheDocument();
  });

  /**
   * The reading colour modes live only in this panel and in the pet parent's Account Settings, and
   * an employee account cannot reach that page at all. If they ever leave here, staff and managers
   * lose high contrast entirely.
   */
  it('reaches every reading colour mode without leaving the bar', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));
    fireEvent.click(screen.getByLabelText('Themes and reading colours'));

    const panel = screen.getByTestId('accessibility-appearance-panel');
    fireEvent.click(within(panel).getByRole('button', { name: /Yellow on black/ }));

    expect(useAccessibilityStore.getState().contrastTheme).toBe('yellow');
  });

  it('closes the panel on Escape before it closes the bar', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));
    fireEvent.click(screen.getByLabelText('Themes and reading colours'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('accessibility-appearance-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('accessibility-toolbar')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('accessibility-toolbar')).not.toBeInTheDocument();
  });

  it('toggles the reading ruler from the toolbar', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    fireEvent.click(screen.getByLabelText('Show a reading ruler'));
    fireEvent.pointerMove(window, { clientY: 200 });

    expect(screen.getByTestId('accessibility-reading-ruler')).toBeInTheDocument();
  });

  it('reports that reading aloud is unavailable when the browser has no speech synthesis', () => {
    render(<AccessibilityWidget />);
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    expect(screen.getByLabelText('Read this page aloud')).toBeDisabled();
    expect(screen.getByText('Reading aloud is not available in this browser.')).toBeInTheDocument();
  });
});

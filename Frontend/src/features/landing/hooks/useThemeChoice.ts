import { useAccessibilityStore } from '../../../shared/accessibility';
import { useBrandThemeStore, type BrandTheme } from '../../../shared/theme';

export interface ThemeChoice {
  theme: BrandTheme;
  chooseTheme: (theme: BrandTheme) => void;
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The visitor's site look, as the landing page offers it.
 *
 * Choosing a theme also turns off any reading colour, as the Account Settings picker does: a
 * reading colour flattens every surface with `!important`, so otherwise the choice would look
 * like it did nothing. Where the browser supports it the change is a short cross-fade; a visitor
 * who asks for reduced motion gets the change at once.
 */
export const useThemeChoice = (): ThemeChoice => {
  const theme = useBrandThemeStore((state) => state.theme);
  const setTheme = useBrandThemeStore((state) => state.setTheme);
  const setContrastTheme = useAccessibilityStore((state) => state.setContrastTheme);

  const chooseTheme = (next: BrandTheme): void => {
    const apply = (): void => {
      setContrastTheme('default');
      setTheme(next);
    };
    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

  return { theme, chooseTheme };
};

import type { ContrastTheme } from './constants';

/**
 * The part of the accessibility state that survives a reload. Toolbar open/closed is deliberately
 * excluded: reopening the bar on every page load would be noise for a visitor who only wanted the
 * larger text.
 */
export interface AccessibilityPreferences {
  isLauncherEnabled: boolean;
  fontScale: number;
  contrastTheme: ContrastTheme;
  isSpacingRelaxed: boolean;
  isRulerVisible: boolean;
}

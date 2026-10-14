import {
  ACCESSIBILITY_STORAGE_KEY,
  CONTRAST_THEMES,
  DEFAULT_FONT_SCALE,
  FONT_SCALE_STEPS,
  type ContrastTheme,
} from './constants';
import type { AccessibilityPreferences } from './types';

export const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  isLauncherEnabled: true,
  fontScale: DEFAULT_FONT_SCALE,
  contrastTheme: 'default',
  isSpacingRelaxed: false,
  isRulerVisible: false,
};

const isContrastTheme = (value: unknown): value is ContrastTheme =>
  CONTRAST_THEMES.includes(value as ContrastTheme);

const isKnownFontScale = (value: unknown): value is number =>
  typeof value === 'number' &&
  FONT_SCALE_STEPS.includes(value as (typeof FONT_SCALE_STEPS)[number]);

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Stored preferences are attacker-free but not shape-free: an older build, a half-written value, or
 * a visitor editing localStorage by hand can all produce junk. Every field is validated so a bad
 * entry degrades to the default instead of leaving the page zoomed to `NaN`.
 */
export const parsePreferences = (raw: string | null): AccessibilityPreferences => {
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCES;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_PREFERENCES;
  }

  const candidate = parsed as Record<string, unknown>;

  return {
    isLauncherEnabled: asBoolean(
      candidate.isLauncherEnabled,
      DEFAULT_PREFERENCES.isLauncherEnabled,
    ),
    fontScale: isKnownFontScale(candidate.fontScale)
      ? candidate.fontScale
      : DEFAULT_PREFERENCES.fontScale,
    contrastTheme: isContrastTheme(candidate.contrastTheme)
      ? candidate.contrastTheme
      : DEFAULT_PREFERENCES.contrastTheme,
    isSpacingRelaxed: asBoolean(candidate.isSpacingRelaxed, DEFAULT_PREFERENCES.isSpacingRelaxed),
    isRulerVisible: asBoolean(candidate.isRulerVisible, DEFAULT_PREFERENCES.isRulerVisible),
  };
};

export const readStoredPreferences = (): AccessibilityPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    return parsePreferences(window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY));
  } catch {
    // Private-browsing modes throw on localStorage access. The toolbar still works, it just
    // forgets the visitor's choices between page loads.
    return DEFAULT_PREFERENCES;
  }
};

export const writeStoredPreferences = (preferences: AccessibilityPreferences): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Same as above: losing persistence must never break the control the visitor just used.
  }
};

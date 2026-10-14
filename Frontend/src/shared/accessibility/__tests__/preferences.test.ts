import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, parsePreferences } from '../preferences';

describe('parsePreferences', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to defaults when the stored value is not valid JSON', () => {
    expect(parsePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid fields and replaces unknown ones with defaults', () => {
    const parsed = parsePreferences(
      JSON.stringify({
        isLauncherEnabled: false,
        fontScale: 130,
        contrastTheme: 'yellow',
        isSpacingRelaxed: 'yes',
        isRulerVisible: true,
      }),
    );

    expect(parsed).toEqual({
      isLauncherEnabled: false,
      fontScale: 130,
      contrastTheme: 'yellow',
      isSpacingRelaxed: DEFAULT_PREFERENCES.isSpacingRelaxed,
      isRulerVisible: true,
    });
  });

  it('rejects a font scale that is not one of the toolbar steps', () => {
    expect(parsePreferences(JSON.stringify({ fontScale: 999 })).fontScale).toBe(
      DEFAULT_PREFERENCES.fontScale,
    );
    expect(parsePreferences(JSON.stringify({ fontScale: 'big' })).fontScale).toBe(
      DEFAULT_PREFERENCES.fontScale,
    );
  });
});

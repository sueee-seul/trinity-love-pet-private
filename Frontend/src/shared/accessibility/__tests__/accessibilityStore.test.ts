import { beforeEach, describe, expect, it } from 'vitest';
import { CONTRAST_THEMES, FONT_SCALE_STEPS } from '../constants';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';

const resetStore = (): void => {
  useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
};

describe('accessibilityStore', () => {
  beforeEach(resetStore);

  it('clamps the text size at both ends of the step list', () => {
    const { decreaseFontScale, increaseFontScale } = useAccessibilityStore.getState();

    decreaseFontScale();
    expect(useAccessibilityStore.getState().fontScale).toBe(FONT_SCALE_STEPS[0]);

    FONT_SCALE_STEPS.forEach(() => increaseFontScale());
    expect(useAccessibilityStore.getState().fontScale).toBe(
      FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1],
    );
  });

  it('applies any contrast theme directly, without stepping through the others', () => {
    const { setContrastTheme } = useAccessibilityStore.getState();

    CONTRAST_THEMES.forEach((theme) => {
      setContrastTheme(theme);
      expect(useAccessibilityStore.getState().contrastTheme).toBe(theme);
    });
  });

  it('restores the default reading experience when the launcher is switched off', () => {
    useAccessibilityStore.setState({
      fontScale: 145,
      contrastTheme: 'yellow',
      isSpacingRelaxed: true,
      isRulerVisible: true,
      isToolbarOpen: true,
    });

    useAccessibilityStore.getState().setLauncherEnabled(false);

    expect(useAccessibilityStore.getState()).toMatchObject({
      isLauncherEnabled: false,
      isToolbarOpen: false,
      fontScale: DEFAULT_PREFERENCES.fontScale,
      contrastTheme: DEFAULT_PREFERENCES.contrastTheme,
      isSpacingRelaxed: false,
      isRulerVisible: false,
    });
  });

  it('keeps the launcher switched on when preferences are reset from the toolbar', () => {
    useAccessibilityStore.setState({ fontScale: 160, isLauncherEnabled: true });

    useAccessibilityStore.getState().resetPreferences();

    const state = useAccessibilityStore.getState();
    expect(state.fontScale).toBe(DEFAULT_PREFERENCES.fontScale);
    expect(state.isLauncherEnabled).toBe(true);
  });

  it('persists preferences so a reload keeps the visitor choice', () => {
    useAccessibilityStore.getState().increaseFontScale();

    expect(window.localStorage.getItem('tlp.accessibility.v1')).toContain('"fontScale":115');
  });
});

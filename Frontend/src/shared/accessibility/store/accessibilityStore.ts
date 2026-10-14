import { create } from 'zustand';
import { FONT_SCALE_STEPS, type ContrastTheme } from '../constants';
import { DEFAULT_PREFERENCES, readStoredPreferences, writeStoredPreferences } from '../preferences';
import type { AccessibilityPreferences } from '../types';

interface AccessibilityState extends AccessibilityPreferences {
  isToolbarOpen: boolean;
  setLauncherEnabled: (isEnabled: boolean) => void;
  openToolbar: () => void;
  closeToolbar: () => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  setContrastTheme: (theme: ContrastTheme) => void;
  toggleRelaxedSpacing: () => void;
  toggleRuler: () => void;
  resetPreferences: () => void;
}

const nextScale = (current: number, direction: 1 | -1): number => {
  const index = FONT_SCALE_STEPS.indexOf(current as (typeof FONT_SCALE_STEPS)[number]);
  const from = index === -1 ? 0 : index;
  const target = Math.min(Math.max(from + direction, 0), FONT_SCALE_STEPS.length - 1);
  return FONT_SCALE_STEPS[target];
};

const toPreferences = (state: AccessibilityState): AccessibilityPreferences => ({
  isLauncherEnabled: state.isLauncherEnabled,
  fontScale: state.fontScale,
  contrastTheme: state.contrastTheme,
  isSpacingRelaxed: state.isSpacingRelaxed,
  isRulerVisible: state.isRulerVisible,
});

export const useAccessibilityStore = create<AccessibilityState>((set) => ({
  ...readStoredPreferences(),
  isToolbarOpen: false,

  // Turning the launcher off also drops every visual adjustment. Leaving a visitor zoomed to 160%
  // with no visible control to undo it would be a trap, since the only way back is this switch.
  setLauncherEnabled: (isEnabled): void =>
    set(
      isEnabled
        ? { isLauncherEnabled: true }
        : { ...DEFAULT_PREFERENCES, isLauncherEnabled: false, isToolbarOpen: false },
    ),

  openToolbar: (): void => set({ isToolbarOpen: true }),
  closeToolbar: (): void => set({ isToolbarOpen: false }),

  increaseFontScale: (): void => set((state) => ({ fontScale: nextScale(state.fontScale, 1) })),
  decreaseFontScale: (): void => set((state) => ({ fontScale: nextScale(state.fontScale, -1) })),

  // Each theme has its own button, so the store only ever needs to be told which one to apply.
  setContrastTheme: (contrastTheme): void => set({ contrastTheme }),

  toggleRelaxedSpacing: (): void => set((state) => ({ isSpacingRelaxed: !state.isSpacingRelaxed })),
  toggleRuler: (): void => set((state) => ({ isRulerVisible: !state.isRulerVisible })),

  // Reset restores the reading experience but keeps the launcher itself where the visitor put it.
  resetPreferences: (): void =>
    set((state) => ({ ...DEFAULT_PREFERENCES, isLauncherEnabled: state.isLauncherEnabled })),
}));

useAccessibilityStore.subscribe((state) => {
  writeStoredPreferences(toPreferences(state));
});

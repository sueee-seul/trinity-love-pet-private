/**
 * Icon names, kept apart from the component so the component module exports only components -
 * React Fast Refresh (and `react/only-export-components`) requires that split.
 */

export const THEME_ICON_NAMES = [
  'arrow',
  'bed',
  'bell',
  'bow',
  'bowl',
  'calendar',
  'camera',
  'chat',
  'check',
  'crown',
  'flower',
  'heart',
  'home',
  'leaf',
  'moon',
  'paw',
  'plus',
  'search',
  'settings',
  'shield',
  'star',
  'sun',
  'user',
  'walk',
] as const;

export type ThemeIconName = (typeof THEME_ICON_NAMES)[number];

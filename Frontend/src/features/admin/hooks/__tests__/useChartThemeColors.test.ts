import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { readChartThemeColors, useChartThemeColors } from '../useChartThemeColors';

const MOONLIGHT_TOKENS = {
  '--color-notice-primary': '#f3effd',
  '--color-notice-secondary': '#bec3dc',
  '--color-border-soft': '#687399',
  '--color-surface-card': '#22283f',
  '--color-theme-sun': '#f0c36b',
  '--color-status-danger': '#ff8a80',
  '--color-status-warning': '#f0c36b',
  '--color-status-success': '#9ad59a',
  '--color-notice-muted': '#9aa0bd',
};

/** The series colours of the default palette, the same in every reading of the defaults. */
const DEFAULT_SERIES = {
  accent: '#eb9c14',
  danger: '#b3372a',
  warning: '#eb9c14',
  success: '#47703e',
  muted: '#7d6959',
};

const setTokens = (tokens: Record<string, string>): void => {
  Object.entries(tokens).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
};

describe('useChartThemeColors', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-a11y-theme');
  });

  it('falls back to the default palette when no token can be read', () => {
    expect(readChartThemeColors()).toEqual({
      label: '#3a2a20',
      axis: '#5a4a3f',
      grid: '#efe0cc',
      labelBackground: '#ffffff',
      ...DEFAULT_SERIES,
    });
  });

  it('redraws with the theme tokens when the theme attribute changes', async () => {
    const { result } = renderHook(() => useChartThemeColors());
    expect(result.current.label).toBe('#3a2a20');

    act(() => {
      setTokens(MOONLIGHT_TOKENS);
      document.documentElement.dataset.theme = 'moonlight';
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        label: '#f3effd',
        axis: '#bec3dc',
        grid: '#687399',
        labelBackground: '#22283f',
        accent: '#f0c36b',
        danger: '#ff8a80',
        warning: '#f0c36b',
        success: '#9ad59a',
        muted: '#9aa0bd',
      });
    });
  });

  it('lets the high contrast reading colours win over the theme', async () => {
    setTokens(MOONLIGHT_TOKENS);
    const { result } = renderHook(() => useChartThemeColors());

    act(() => {
      setTokens({ '--a11y-fg': '#ffff00', '--a11y-border': '#ffff00', '--a11y-bg': '#000000' });
      document.documentElement.dataset.a11yTheme = 'yellow';
    });

    await waitFor(() => {
      // The reading palette takes the text and grid; the series keep the theme's status hues.
      expect(result.current).toEqual({
        label: '#ffff00',
        axis: '#ffff00',
        grid: '#ffff00',
        labelBackground: '#000000',
        accent: '#f0c36b',
        danger: '#ff8a80',
        warning: '#f0c36b',
        success: '#9ad59a',
        muted: '#9aa0bd',
      });
    });
  });

  it('keeps the same object while the colours stay the same', () => {
    const { result, rerender } = renderHook(() => useChartThemeColors());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

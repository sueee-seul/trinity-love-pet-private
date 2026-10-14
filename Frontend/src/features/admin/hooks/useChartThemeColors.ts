import { useSyncExternalStore } from 'react';
// Every chart reads its colours through this hook, so importing the chart font here sets it once
// for all of them.
import '../utils/chartFont';

/**
 * Colours for the parts of a chart.js chart that are not data: axis text, grid lines and value
 * labels.
 *
 * A chart draws on a canvas, and a canvas does not read CSS. Left alone, chart.js paints grey ticks
 * and near-black labels that were chosen for a white card, and they disappear on the dark themes.
 * So these colours come from the same tokens the rest of the page uses.
 */
export interface ChartThemeColors {
  /** Value labels drawn next to bars, points and ring segments. */
  label: string;
  /** Axis ticks and legend text. */
  axis: string;
  /** Grid lines and axis lines. */
  grid: string;
  /** The chip drawn behind a value label, on charts that draw one. */
  labelBackground: string;
  /** Data colours: the brand accent for a single series, the status colours for high, medium and low. */
  accent: string;
  danger: string;
  warning: string;
  success: string;
  muted: string;
}

/*
 * The Default palette values from index.css. They are used only when a token cannot be read, for
 * example in a test with no stylesheet, so a chart never receives an empty colour.
 */
const DEFAULT_CHART_COLORS: ChartThemeColors = {
  label: '#3a2a20',
  axis: '#5a4a3f',
  grid: '#efe0cc',
  labelBackground: '#ffffff',
  accent: '#eb9c14',
  danger: '#b3372a',
  warning: '#eb9c14',
  success: '#47703e',
  muted: '#7d6959',
};

/** The attributes on `<html>` that change what the colour tokens resolve to. */
const THEME_ATTRIBUTES = ['data-theme', 'data-a11y-theme'];

const readToken = (styles: CSSStyleDeclaration, name: string, fallback: string): string =>
  styles.getPropertyValue(name).trim() || fallback;

type SeriesColors = Pick<ChartThemeColors, 'accent' | 'danger' | 'warning' | 'success' | 'muted'>;

const readSeriesColors = (styles: CSSStyleDeclaration): SeriesColors => ({
  accent: readToken(styles, '--color-theme-sun', DEFAULT_CHART_COLORS.accent),
  danger: readToken(styles, '--color-status-danger', DEFAULT_CHART_COLORS.danger),
  warning: readToken(styles, '--color-status-warning', DEFAULT_CHART_COLORS.warning),
  success: readToken(styles, '--color-status-success', DEFAULT_CHART_COLORS.success),
  muted: readToken(styles, '--color-notice-muted', DEFAULT_CHART_COLORS.muted),
});

/** Reads the chart colours that apply to the document right now. */
export const readChartThemeColors = (): ChartThemeColors => {
  if (typeof document === 'undefined') {
    return DEFAULT_CHART_COLORS;
  }

  const styles = getComputedStyle(document.documentElement);

  // The high contrast reading colours define these only while one is switched on. They win over
  // the theme here for the same reason they win in accessibility.css: a visitor who needs them has
  // to get them everywhere.
  const readingForeground = styles.getPropertyValue('--a11y-fg').trim();
  if (readingForeground) {
    return {
      label: readingForeground,
      axis: readingForeground,
      grid: readToken(styles, '--a11y-border', readingForeground),
      labelBackground: readToken(styles, '--a11y-bg', DEFAULT_CHART_COLORS.labelBackground),
      // Series keep their status hues: a bar's meaning is its colour, and the status tokens are
      // what the reading palettes remap for contrast.
      ...readSeriesColors(styles),
    };
  }

  return {
    label: readToken(styles, '--color-notice-primary', DEFAULT_CHART_COLORS.label),
    axis: readToken(styles, '--color-notice-secondary', DEFAULT_CHART_COLORS.axis),
    grid: readToken(styles, '--color-border-soft', DEFAULT_CHART_COLORS.grid),
    labelBackground: readToken(
      styles,
      '--color-surface-card',
      DEFAULT_CHART_COLORS.labelBackground,
    ),
    ...readSeriesColors(styles),
  };
};

const isSameColors = (left: ChartThemeColors, right: ChartThemeColors): boolean =>
  (Object.keys(left) as (keyof ChartThemeColors)[]).every((key) => left[key] === right[key]);

// React compares snapshots by identity, so the same object is handed back until a value changes.
let currentColors = DEFAULT_CHART_COLORS;

const getSnapshot = (): ChartThemeColors => {
  const nextColors = readChartThemeColors();
  if (!isSameColors(nextColors, currentColors)) {
    currentColors = nextColors;
  }
  return currentColors;
};

const getServerSnapshot = (): ChartThemeColors => DEFAULT_CHART_COLORS;

/*
 * Both the brand theme and the reading colours are applied as attributes on `<html>`, by two
 * different stores and at different points in a render. Watching the attributes themselves means
 * the chart redraws after either one lands, whichever order they arrive in.
 */
const subscribe = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: THEME_ATTRIBUTES,
  });
  return () => observer.disconnect();
};

/** The current chart colours, updated whenever the theme or a reading colour changes. */
export const useChartThemeColors = (): ChartThemeColors =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

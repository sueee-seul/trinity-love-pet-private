import type { ChartThemeColors } from '../hooks/useChartThemeColors';

interface ChartAxisOptions {
  ticks?: object;
}

/**
 * Adds the theme's tick, grid and axis line colours to one chart.js axis.
 *
 * Every KPI chart needs the same three colours on every axis, and chart.js will otherwise fall back
 * to its own grey and black, which only work on a white card.
 */
export const themedChartAxis = <Axis extends ChartAxisOptions>(
  colors: ChartThemeColors,
  axis: Axis,
): Axis & {
  ticks: Axis['ticks'] & { color: string };
  grid: { color: string };
  border: { color: string };
} => ({
  ...axis,
  ticks: { ...axis.ticks, color: colors.axis },
  grid: { color: colors.grid },
  border: { color: colors.grid },
});

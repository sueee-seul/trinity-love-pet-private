import { describe, expect, it } from 'vitest';
import { themedChartAxis } from '../themedChartAxis';

const COLORS = {
  label: '#f3effd',
  axis: '#bec3dc',
  grid: '#687399',
  labelBackground: '#22283f',
  accent: '#f0c36b',
  danger: '#ff8a80',
  warning: '#f0c36b',
  success: '#9ad59a',
  muted: '#9aa0bd',
};

describe('themedChartAxis', () => {
  it('colours the ticks, grid and axis line from the theme', () => {
    const axis = themedChartAxis(COLORS, { beginAtZero: true, ticks: { maxTicksLimit: 7 } });

    expect(axis).toEqual({
      beginAtZero: true,
      ticks: { maxTicksLimit: 7, color: '#bec3dc' },
      grid: { color: '#687399' },
      border: { color: '#687399' },
    });
  });

  it('keeps the tick callback the chart passed in', () => {
    const callback = (value: number | string): string => `${value}%`;

    const axis = themedChartAxis(COLORS, { ticks: { callback } });

    expect(axis.ticks.callback).toBe(callback);
  });
});

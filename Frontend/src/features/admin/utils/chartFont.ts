import { Chart as ChartJS } from 'chart.js';

/**
 * The font chart.js draws labels, ticks and legends with.
 *
 * A chart draws on a canvas, which does not read CSS font stacks. chart.js otherwise uses
 * Helvetica or Arial, and a Chinese name on a chart then renders in the system face (Microsoft
 * YaHei on Windows), which the product does not use. So charts use Inter, like the rest of the
 * admin text, with the same Chinese serif fallback as the stylesheet.
 */
export const CHART_FONT_FAMILY =
  "'Inter', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', sans-serif";

ChartJS.defaults.font.family = CHART_FONT_FAMILY;

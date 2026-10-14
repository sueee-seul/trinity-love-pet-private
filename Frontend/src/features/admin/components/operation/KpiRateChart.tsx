import { KpiChartHelp } from './KpiChartHelp';
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';
import { themedChartAxis } from '../../utils/themedChartAxis';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * A KPI rate (percentage) chart rendered as a line chart.
 * When only one data point is available, renders a large centered display
 * value instead of a chart to avoid a meaningless single-point line.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Time-bucket labels for the x-axis.
 * @param values         - Percentage values (0 to 100) or null for missing data.
 * @param color          - Stroke color for the line; fill uses a 20%-opacity variant.
 * @param description    - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiRateChartProps {
  title: string;
  labels: string[];
  values: (number | null)[];
  color: string;
  description?: string;
}

export const KpiRateChart: React.FC<KpiRateChartProps> = ({
  title,
  labels,
  values,
  color,
  description,
}) => {
  const chartColors = useChartThemeColors();
  const hasMultiplePoints = labels.length > 1;

  if (!hasMultiplePoints) {
    const value = values[0];
    const displayValue = value !== null && value !== undefined ? `${value.toFixed(1)}%` : 'No data';

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="type-button text-notice-primary">{title}</h3>
          {description && <KpiChartHelp title={title} description={description} />}
        </div>
        <div className="mt-2 flex h-32 items-center justify-center rounded-xl border border-border-soft bg-surface-deep/50">
          <span className="type-display text-notice-primary">{displayValue}</span>
        </div>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => {
            const value = context.parsed.y;
            return value !== null && value !== undefined ? `${value.toFixed(1)}%` : 'No data';
          },
        },
      },
    },
    scales: {
      y: themedChartAxis(chartColors, {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (value: number | string) => `${value}%`,
        },
      }),
      x: themedChartAxis(chartColors, {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
        },
      }),
    },
  } as const;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <h3 className="type-button text-notice-primary">{title}</h3>
        {description && <KpiChartHelp title={title} description={description} />}
      </div>
      <div className="h-56 w-full overflow-hidden">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

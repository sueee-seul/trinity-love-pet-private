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
import DatalabelsPlugin from 'chartjs-plugin-datalabels';
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
  DatalabelsPlugin,
);

/**
 * A line chart for KPI dashboards.
 * Renders a single series as a smooth line with optional data labels
 * and a filled area beneath the line.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Category labels for the x-axis.
 * @param values         - Data values for each point on the line.
 * @param color          - Line and point color; fill uses a 20%-opacity variant.
 * @param unit           - Display unit appended to tooltip and axis labels.
 * @param showDataLabels - When true, renders each point's value above it.
 * @param description    - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiLineChartProps {
  title: string;
  labels: string[];
  values: number[];
  color: string;
  unit?: string;
  showDataLabels?: boolean;
  description?: string;
}

export const KpiLineChart: React.FC<KpiLineChartProps> = ({
  title,
  labels,
  values,
  color,
  unit = '',
  showDataLabels = false,
  description,
}) => {
  const chartColors = useChartThemeColors();
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
      datalabels: {
        display: showDataLabels,
        align: 'top' as const,
        color: chartColors.label,
        font: {
          weight: 'bold',
          size: 11,
        },
        formatter: (value: number) => `${value.toFixed(0)}${unit}`,
      },
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y: number | null } }) => {
            const value = context.parsed.y;
            return value !== null && value !== undefined ? `${value.toFixed(1)}${unit}` : 'No data';
          },
        },
      },
    },
    scales: {
      y: themedChartAxis(chartColors, {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value}${unit}`,
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

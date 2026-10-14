import { KpiChartHelp } from './KpiChartHelp';
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import DatalabelsPlugin from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';
import { themedChartAxis } from '../../utils/themedChartAxis';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, DatalabelsPlugin);

/**
 * A grouped bar chart for KPI dashboards.
 * Each category shows multiple adjacent bars (one per dataset),
 * allowing comparison across multiple series simultaneously.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Category labels for the x-axis.
 * @param datasets       - Array of series, each with label, data, and color.
 * @param unit           - Display unit appended to tooltip and axis labels.
 * @param showDataLabels - When true, renders each bar's value above it.
 * @param description    - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiGroupedBarChartProps {
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
  }>;
  unit?: string;
  showDataLabels?: boolean;
  description?: string;
}

export const KpiGroupedBarChart: React.FC<KpiGroupedBarChartProps> = ({
  title,
  labels,
  datasets,
  unit = '',
  showDataLabels = false,
  description,
}) => {
  const chartColors = useChartThemeColors();
  const data = {
    labels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: chartColors.axis } },
      datalabels: {
        display: showDataLabels,
        color: chartColors.label,
        font: {
          weight: 'bold',
          size: 11,
        },
        formatter: (value: number) => `${value.toFixed(0)}${unit}`,
      },
      tooltip: {
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const value = context.parsed.y;
            const datasetLabel = context.dataset.label ?? '';
            return value !== null && value !== undefined
              ? `${datasetLabel}: ${value.toFixed(0)}${unit}`
              : 'No data';
          },
        },
      },
    },
    scales: {
      x: themedChartAxis(chartColors, {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
        },
      }),
      y: themedChartAxis(chartColors, {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value}${unit}`,
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
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

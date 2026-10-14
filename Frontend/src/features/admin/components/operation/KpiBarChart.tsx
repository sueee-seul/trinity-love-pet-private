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
  type ChartDataset,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';
import { themedChartAxis } from '../../utils/themedChartAxis';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type KpiBarChartDataset = ChartDataset<'bar', (number | null)[]>;

/**
 * A single-series or multi-series bar chart for KPI dashboards.
 * Renders a title, then a Chart.js Bar inside a constrained height container.
 * When a single series is provided, bars use the supplied color (blue by default).
 * When multiple datasets are provided, the chart switches to stacked mode and
 * shows a legend so each dataset is distinguishable.
 *
 * @param title   - Chart heading displayed above the chart.
 * @param labels  - Category labels for the x-axis.
 * @param values  - Optional single-series data (used when `datasets` is omitted).
 * @param color   - Bar color for single-series mode; defaults to blue (**#3b82f6**).
 * @param unit    - Display unit appended to tooltip and axis labels; defaults to 'min'.
 * @param datasets - Optional multi-series configuration for stacked/grouped rendering.
 * @param description - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiBarChartProps {
  title: string;
  labels: string[];
  values?: (number | null)[];
  color?: string;
  unit?: string;
  datasets?: KpiBarChartDataset[];
  description?: string;
}

export const KpiBarChart: React.FC<KpiBarChartProps> = ({
  title,
  labels,
  values,
  color = '#3b82f6',
  unit = 'min',
  datasets,
  description,
}) => {
  const chartColors = useChartThemeColors();
  const data = {
    labels,
    datasets: datasets ?? [
      {
        label: title,
        data: values ?? [],
        backgroundColor: `${color}99`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: datasets !== undefined && datasets.length > 1,
        labels: { color: chartColors.axis },
      },
      tooltip: {
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const value = context.parsed.y;
            const datasetLabel = context.dataset.label ?? '';
            return value !== null && value !== undefined
              ? `${datasetLabel}: ${value.toFixed(0)} ${unit}`
              : 'No data';
          },
        },
      },
    },
    scales: {
      y: themedChartAxis(chartColors, {
        beginAtZero: true,
        stacked: datasets !== undefined && datasets.length > 1,
        ticks: {
          callback: (value: number | string) => `${value} ${unit}`,
        },
      }),
      x: themedChartAxis(chartColors, {
        stacked: datasets !== undefined && datasets.length > 1,
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
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

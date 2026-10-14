import React from 'react';
import { KpiChartHelp } from './KpiChartHelp';
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
 * A histogram-style bar chart for KPI dashboards.
 * Renders frequency or count data as vertical bars, with optional
 * data labels at the end of each bar.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Bucket labels for the x-axis.
 * @param values         - Count or frequency for each bucket.
 * @param color          - Bar color.
 * @param unit           - Display unit appended to tooltip and axis labels.
 * @param showDataLabels - When true, renders each bar's value above it.
 * @param description    - Optional help text shown by the "?" helper next to the title.
 */
interface KpiHistogramProps {
  title: string;
  labels: string[];
  values: number[];
  color: string;
  unit?: string;
  showDataLabels?: boolean;
  description?: string;
}

export const KpiHistogram: React.FC<KpiHistogramProps> = ({
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
      legend: { display: false },
      datalabels: {
        display: showDataLabels,
        align: 'end' as const,
        anchor: 'end' as const,
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
            return value !== null && value !== undefined ? `${value.toFixed(0)}${unit}` : 'No data';
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
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

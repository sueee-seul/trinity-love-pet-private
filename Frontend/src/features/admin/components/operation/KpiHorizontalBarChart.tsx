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
 * A horizontal bar chart for KPI dashboards.
 * Bars extend horizontally from the y-axis, ideal for comparing values
 * across categories with long labels.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Category labels for the y-axis.
 * @param values         - Data values for each category.
 * @param color          - Bar color.
 * @param unit           - Display unit appended to tooltip and axis labels.
 * @param showDataLabels - When true, renders each bar's value at its end.
 * @param description    - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiHorizontalBarChartProps {
  title: string;
  labels: string[];
  values: number[];
  color: string;
  unit?: string;
  showDataLabels?: boolean;
  description?: string;
}

export const KpiHorizontalBarChart: React.FC<KpiHorizontalBarChartProps> = ({
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
    indexAxis: 'y' as const,
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
          label: (context: { parsed: { x: number | null } }) => {
            const value = context.parsed.x;
            return value !== null && value !== undefined ? `${value.toFixed(0)}${unit}` : 'No data';
          },
        },
      },
    },
    scales: {
      x: themedChartAxis(chartColors, {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `${value}${unit}`,
        },
      }),
      y: themedChartAxis(chartColors, {
        ticks: {
          maxRotation: 0,
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

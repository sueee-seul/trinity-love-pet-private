import { KpiChartHelp } from './KpiChartHelp';
import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import DatalabelsPlugin from 'chartjs-plugin-datalabels';
import { Doughnut } from 'react-chartjs-2';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';

ChartJS.register(ArcElement, Tooltip, Legend, DatalabelsPlugin);

/**
 * A donut chart for KPI dashboards.
 * Renders categorical proportions as a ring, with optional data labels
 * that can display either raw counts or percentages.
 *
 * @param title           - Chart heading displayed above the chart.
 * @param labels          - Category labels for each segment.
 * @param values          - Numeric values for each segment.
 * @param colors          - Optional color palette; defaults to a 6-color palette.
 * @param showDataLabels  - When true, renders each segment's value or percentage inside the ring.
 * @param showPercentages - When true and showDataLabels is enabled, displays percentages instead of raw values.
 * @param description     - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiDonutChartProps {
  title: string;
  labels: string[];
  values: number[];
  colors?: string[];
  showDataLabels?: boolean;
  showPercentages?: boolean;
  description?: string;
}

export const KpiDonutChart: React.FC<KpiDonutChartProps> = ({
  title,
  labels,
  values,
  colors,
  showDataLabels = true,
  showPercentages = true,
  description,
}) => {
  const chartColors = useChartThemeColors();
  const palette = colors ?? ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899'];
  const total = values.reduce((sum, value) => sum + value, 0);
  const data = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: palette,
        borderColor: palette,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 24,
        bottom: 24,
      },
    },
    plugins: {
      legend: { display: true, position: 'right' as const, labels: { color: chartColors.axis } },
      datalabels: {
        display: showDataLabels,
        position: 'outside' as const,
        backgroundColor: chartColors.labelBackground,
        borderRadius: 4,
        color: chartColors.label,
        font: {
          weight: 'bold',
          size: 12,
        },
        formatter: (value: number) => {
          if (showPercentages) {
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${pct}%`;
          }
          return `${value}`;
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { label?: string; parsed: number }) => {
            const labelText = context.label ?? '';
            const value = context.parsed;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${labelText}: ${value} (${pct}%)`;
          },
        },
      },
    },
  } as const;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <h3 className="type-button text-notice-primary">{title}</h3>
        {description && <KpiChartHelp title={title} description={description} />}
      </div>
      <div className="h-56 w-full overflow-hidden">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

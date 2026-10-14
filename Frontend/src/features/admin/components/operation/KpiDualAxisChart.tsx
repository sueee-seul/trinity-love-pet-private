import { KpiChartHelp } from './KpiChartHelp';
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import DatalabelsPlugin from 'chartjs-plugin-datalabels';
import { Chart } from 'react-chartjs-2';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';
import { themedChartAxis } from '../../utils/themedChartAxis';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  DatalabelsPlugin,
);

/**
 * A dual-axis chart combining a bar series and a line series.
 * Bars and line share the same categories but use separate y-axes
 * (left for bars, right for line), allowing comparison of values
 * with different scales or units.
 *
 * @param title          - Chart heading displayed above the chart.
 * @param labels         - Category labels for the x-axis.
 * @param barValues      - Data values for the bar series.
 * @param lineValues     - Data values for the line series.
 * @param barLabel       - Legend label for the bar series.
 * @param lineLabel      - Legend label for the line series.
 * @param barColor       - Color for the bar series.
 * @param lineColor      - Color for the line series.
 * @param barUnit        - Display unit for bar values in tooltips and axis labels.
 * @param lineUnit       - Display unit for line values in tooltips and axis labels.
 * @param showDataLabels - When true, renders each data point's value.
 * @param description    - Optional help text shown when opening the "?" helper next to the title.
 */
interface KpiDualAxisChartProps {
  title: string;
  labels: string[];
  barValues: number[];
  lineValues: number[];
  barLabel: string;
  lineLabel: string;
  barColor: string;
  lineColor: string;
  barUnit?: string;
  lineUnit?: string;
  showDataLabels?: boolean;
  description?: string;
}

export const KpiDualAxisChart: React.FC<KpiDualAxisChartProps> = ({
  title,
  labels,
  barValues,
  lineValues,
  barLabel,
  lineLabel,
  barColor,
  lineColor,
  barUnit = '',
  lineUnit = '',
  showDataLabels = false,
  description,
}) => {
  const chartColors = useChartThemeColors();
  const data = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: barLabel,
        data: barValues,
        backgroundColor: `${barColor}99`,
        borderColor: barColor,
        borderWidth: 1,
        borderRadius: 2,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: lineLabel,
        data: lineValues,
        borderColor: lineColor,
        backgroundColor: `${lineColor}20`,
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      },
    ],
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
        formatter: (value: number, context: { dataset: { label?: string } }) => {
          const datasetLabel = context.dataset.label ?? '';
          const unit = datasetLabel === barLabel ? barUnit : lineUnit;
          return `${value.toFixed(0)}${unit}`;
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const value = context.parsed.y;
            const datasetLabel = context.dataset.label ?? '';
            const unit = datasetLabel === barLabel ? barUnit : lineUnit;
            return value !== null && value !== undefined
              ? `${datasetLabel}: ${value.toFixed(1)}${unit}`
              : 'No data';
          },
        },
      },
    },
    scales: {
      y: themedChartAxis(chartColors, {
        type: 'linear' as const,
        beginAtZero: true,
        position: 'left' as const,
        ticks: {
          callback: (value: number | string) => `${value}${barUnit}`,
        },
      }),
      y1: themedChartAxis(chartColors, {
        type: 'linear' as const,
        beginAtZero: true,
        position: 'right' as const,
        ticks: {
          callback: (value: number | string) => `${value}${lineUnit}`,
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
        <Chart type="bar" data={data} options={options} />
      </div>
    </div>
  );
};

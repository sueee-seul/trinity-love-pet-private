import React, { useState } from 'react';
import { LoadingState } from '../../../../shared/components/ui/LoadingState';
import { useKpiDashboard } from '../../hooks/useKpiDashboard';
import { useChartThemeColors } from '../../hooks/useChartThemeColors';
import { KpiTimeRangeSelector } from './KpiTimeRangeSelector';
import { KpiDailySummaryCard } from './KpiDailySummaryCard';
import { KpiPeriodSummaryCard } from './KpiPeriodSummaryCard';
import { KpiLineChart } from './KpiLineChart';
import { KpiDualAxisChart } from './KpiDualAxisChart';
import { KpiHorizontalBarChart } from './KpiHorizontalBarChart';
import { KpiDonutChart } from './KpiDonutChart';
import { KpiStackedBarChart } from './KpiStackedBarChart';
import { KpiGroupedBarChart } from './KpiGroupedBarChart';
import { KpiSideBySideBarChart } from './KpiSideBySideBarChart';
import { KpiHistogram } from './KpiHistogram';

export const KpiDashboard: React.FC = () => {
  // Series colours follow the theme like every other chart colour; a canvas cannot read CSS.
  const chartColors = useChartThemeColors();
  const { data, status, error, refresh, range, setRange } = useKpiDashboard();
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [showPercentages, setShowPercentages] = useState(true);

  if (status === 'loading' || status === 'refreshing' || status === 'idle') {
    return <LoadingState label="Loading KPI dashboard…" variant="section" className="py-20" />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-5 border-b border-border-soft pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="type-display text-notice-primary">KPI</h1>
              <span className="rounded-full bg-surface-bubbles px-3 py-1 type-meta font-bold text-theme-earth">
                Manager view
              </span>
            </div>
            <p className="mt-2 type-body text-notice-secondary">Business overview</p>
          </div>
        </header>

        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 type-body text-status-danger"
        >
          <span>{error ?? 'The KPI dashboard is unavailable right now.'}</span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-status-danger/30 px-3 py-1.5 type-button text-status-danger hover:bg-surface-card"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-border-soft pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display text-notice-primary">KPI</h1>
            <span className="rounded-full bg-surface-bubbles px-3 py-1 type-meta font-bold text-theme-earth">
              Manager view
            </span>
          </div>
          <p className="mt-2 type-body text-notice-secondary">Business overview</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <KpiTimeRangeSelector value={range} onChange={setRange} />
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-deep">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels(e.target.checked)}
              className="h-4 w-4 rounded border-border-soft accent-theme-earth"
            />
            Data labels
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-deep">
            <input
              type="checkbox"
              checked={showPercentages}
              onChange={(e) => setShowPercentages(e.target.checked)}
              className="h-4 w-4 rounded border-border-soft accent-theme-earth"
            />
            Donut percentages
          </label>
          <button
            type="button"
            onClick={refresh}
            className="min-h-11 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-deep"
          >
            Refresh
          </button>
        </div>
      </header>
      {range === 'today' ? <KpiDailySummaryCard /> : <KpiPeriodSummaryCard range={range} />}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiLineChart
            title="Task Completion Trend"
            labels={data.completionTrend.map((item) => item.label)}
            values={data.completionTrend.map((item) => item.value)}
            color="#22c55e"
            unit="%"
            showDataLabels={showDataLabels}
            description="Daily completion rate: share of tasks scheduled that day that were completed."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiDualAxisChart
            title="Overdue Rate"
            labels={data.overdueRate.map((item) => item.label)}
            barValues={data.overdueRate.map((item) => item.primary)}
            lineValues={data.overdueRate.map((item) => item.secondary)}
            barLabel="Overdue"
            lineLabel="On time"
            barColor="#ef4444"
            lineColor="#22c55e"
            lineUnit="%"
            showDataLabels={showDataLabels}
            description="Distribution of completion delays past the 30-minute window after the scheduled time: how many tasks fell into each delay bucket (0-10m, 10-30m, up to 4h+)."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiLineChart
            title="Average Completion Time"
            labels={data.avgCompletionTime.map((item) => item.label)}
            values={data.avgCompletionTime.map((item) => item.value)}
            color="#3b82f6"
            unit="m"
            showDataLabels={showDataLabels}
            description="Average time from the scheduled time (set in Task Timeline) to completion, per day."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiDonutChart
            title="Task Distribution by Category"
            labels={data.categoryDistribution.map((item) => item.label)}
            values={data.categoryDistribution.map((item) => item.value)}
            showDataLabels={showDataLabels}
            showPercentages={showPercentages}
            description="How many tasks scheduled in the selected range fall into each service category (Feeding, Medical, Grooming, Walking, Playtime, Potty, Wellness, Other)."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiStackedBarChart
            title="Priority Breakdown"
            labels={data.priorityBreakdown.map((item) => item.label)}
            datasets={[
              {
                label: 'Tasks',
                data: data.priorityBreakdown.map((item) => item.value),
                backgroundColor: chartColors.accent,
              },
            ]}
            unit=""
            showDataLabels={showDataLabels}
            description="Count of active (non-cancelled) tasks grouped by priority level: High, Medium, Low."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiHorizontalBarChart
            title="Tasks per Employee"
            labels={data.tasksPerEmployee.map((item) => item.label)}
            values={data.tasksPerEmployee.map((item) => item.value)}
            color="#a855f7"
            unit=""
            showDataLabels={showDataLabels}
            description="Number of tasks scheduled in the selected range assigned to each staff member, sorted by count."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiDonutChart
            title="Task Status Overview"
            labels={data.statusOverview.map((item) => item.label)}
            values={data.statusOverview.map((item) => item.value)}
            showDataLabels={showDataLabels}
            showPercentages={showPercentages}
            description="Breakdown of all tasks by current status: Pending, In Progress, Completed, Cancelled."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiDualAxisChart
            title="Scheduled vs Completed Tasks"
            labels={data.scheduledVsCompleted.map((item) => item.label)}
            barValues={data.scheduledVsCompleted.map((item) => item.primary)}
            lineValues={data.scheduledVsCompleted.map((item) => item.secondary)}
            barLabel="Scheduled"
            lineLabel="Completed"
            barColor="#eab308"
            lineColor="#22c55e"
            showDataLabels={showDataLabels}
            description="Tasks scheduled per day (yellow bars) versus how many of those tasks were completed (green line)."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiHistogram
            title="Average Delay Time"
            labels={data.avgDelayTime.map((item) => item.label)}
            values={data.avgDelayTime.map((item) => item.value)}
            color="#ef4444"
            unit="m"
            showDataLabels={showDataLabels}
            description="Distribution of completion delays: how many tasks were completed within various delay buckets (0-10m, 10-30m, up to 4h+)."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiHorizontalBarChart
            title="Tasks by Pet"
            labels={data.tasksByPet.map((item) => item.label)}
            values={data.tasksByPet.map((item) => item.value)}
            color="#ec4899"
            unit=""
            showDataLabels={showDataLabels}
            description="Total number of active tasks per pet, sorted by count."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiSideBySideBarChart
            title="Task Type Comparison"
            labels={data.taskTypeComparison.map((item) => item.label)}
            leftValues={data.taskTypeComparison.map((item) => item.primary)}
            rightValues={data.taskTypeComparison.map((item) => item.secondary)}
            leftLabel="Staff"
            rightLabel="Pet"
            leftColor="#3b82f6"
            rightColor="#22c55e"
            showDataLabels={showDataLabels}
            description="Side-by-side comparison of staff-created task counts (blue) vs pet-related task counts (green) per service type, for tasks scheduled in the selected range."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
          <KpiLineChart
            title="Task Creation Trend"
            labels={data.creationTrend.map((item) => item.label)}
            values={data.creationTrend.map((item) => item.value)}
            color="#eab308"
            unit=""
            showDataLabels={showDataLabels}
            description="Number of new tasks created each day in the selected range."
          />
        </div>

        <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card xl:col-span-2">
          <KpiGroupedBarChart
            title="Completion Efficiency by Priority"
            labels={data.completionEfficiencyByPriority.map((item) => item.label)}
            datasets={[
              {
                label: 'High',
                data: data.completionEfficiencyByPriority.map((item) => item.high),
                backgroundColor: chartColors.danger,
              },
              {
                label: 'Medium',
                data: data.completionEfficiencyByPriority.map((item) => item.medium),
                backgroundColor: chartColors.warning,
              },
              {
                label: 'Low',
                data: data.completionEfficiencyByPriority.map((item) => item.low),
                backgroundColor: chartColors.success,
              },
            ]}
            unit="%"
            showDataLabels={showDataLabels}
            description="On-time completion rate per scheduled day by priority: share of completed tasks finished within 30 minutes of their scheduled time. High (red), Medium (amber), Low (green)."
          />
        </div>
      </div>
    </div>
  );
};

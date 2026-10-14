export interface KpiSeriesPoint {
  label: string;
  value: number;
}

export interface KpiDualSeriesPoint {
  label: string;
  primary: number;
  secondary: number;
}

export interface KpiTripleSeriesPoint {
  label: string;
  high: number;
  medium: number;
  low: number;
}

export interface KpiCategoryPoint {
  label: string;
  value: number;
}

export interface KpiEmployeePoint {
  label: string;
  value: number;
}

export interface KpiPetPoint {
  label: string;
  value: number;
}

export type KpiRange = 'today' | '7d' | '30d' | '90d';

const todayLabel = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${day}/${month}`;
};

const monthDayLabels = (days: number): string[] => {
  const labels: string[] = [];
  const now = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    const formatter = new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    labels.push(`${day}/${month}`);
  }
  return labels;
};

const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

export const generateCompletionTrend = (range: KpiRange): KpiSeriesPoint[] => {
  const labels =
    range === 'today'
      ? [todayLabel()]
      : monthDayLabels(range === '7d' ? 7 : range === '30d' ? 30 : 90);
  const random = seededRandom(1);
  return labels.map((label) => ({
    label,
    value: Number((random() * 60 + 20).toFixed(1)),
  }));
};

export const generateOverdueRate = (range: KpiRange): KpiDualSeriesPoint[] => {
  const labels =
    range === 'today'
      ? [todayLabel()]
      : monthDayLabels(range === '7d' ? 7 : range === '30d' ? 30 : 90);
  const random = seededRandom(2);
  return labels.map((label) => ({
    label,
    primary: Number((random() * 30 + 5).toFixed(1)),
    secondary: Number((random() * 70 + 20).toFixed(1)),
  }));
};

export const generateAvgCompletionTime = (range: KpiRange): KpiSeriesPoint[] => {
  const count = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const labels = monthDayLabels(count);
  const random = seededRandom(3);
  return labels.map((label) => ({
    label,
    value: Number((random() * 120 + 15).toFixed(0)),
  }));
};

export const generateCategoryDistribution = (): KpiCategoryPoint[] => [
  { label: 'Grooming', value: 35 },
  { label: 'Feeding', value: 25 },
  { label: 'Walking', value: 20 },
  { label: 'Training', value: 12 },
  { label: 'Medical', value: 8 },
];

export const generatePriorityBreakdown = (): KpiCategoryPoint[] => [
  { label: 'High', value: 28 },
  { label: 'Medium', value: 45 },
  { label: 'Low', value: 27 },
];

export const generateTasksPerEmployee = (): KpiEmployeePoint[] => [
  { label: 'Alice', value: 42 },
  { label: 'Ben', value: 38 },
  { label: 'Chloe', value: 35 },
  { label: 'Dan', value: 29 },
  { label: 'Ella', value: 24 },
];

export const generateStatusOverview = (): KpiCategoryPoint[] => [
  { label: 'Pending', value: 18 },
  { label: 'In progress', value: 32 },
  { label: 'Completed', value: 44 },
  { label: 'Cancelled', value: 6 },
];

export const generateScheduledVsCompleted = (): KpiDualSeriesPoint[] => {
  const labels = monthDayLabels(14);
  const random = seededRandom(8);
  return labels.map((label) => ({
    label,
    primary: Number((random() * 50 + 20).toFixed(0)),
    secondary: Number((random() * 40 + 15).toFixed(0)),
  }));
};

export const generateAvgDelayTime = (): KpiSeriesPoint[] => {
  const labels = ['0-10m', '10-30m', '30-60m', '1-2h', '2-4h', '4h+'];
  const random = seededRandom(9);
  return labels.map((label) => ({
    label,
    value: Number((random() * 80 + 5).toFixed(0)),
  }));
};

export const generateTasksByPet = (): KpiPetPoint[] => [
  { label: 'Mochi', value: 18 },
  { label: 'Coco', value: 15 },
  { label: 'Rocky', value: 12 },
  { label: 'Luna', value: 11 },
  { label: 'Bailey', value: 9 },
  { label: 'Daisy', value: 7 },
];

export const generateTaskTypeComparison = (): KpiDualSeriesPoint[] => [
  { label: 'Grooming', primary: 40, secondary: 25 },
  { label: 'Feeding', primary: 30, secondary: 35 },
  { label: 'Walking', primary: 20, secondary: 40 },
  { label: 'Training', primary: 15, secondary: 10 },
  { label: 'Medical', primary: 10, secondary: 5 },
];

export const generateCreationTrend = (range: KpiRange): KpiSeriesPoint[] => {
  const labels =
    range === 'today'
      ? [todayLabel()]
      : monthDayLabels(range === '7d' ? 7 : range === '30d' ? 30 : 90);
  const random = seededRandom(12);
  return labels.map((label) => ({
    label,
    value: Number((random() * 40 + 10).toFixed(0)),
  }));
};

export const generateCompletionEfficiencyByPriority = (): KpiTripleSeriesPoint[] => {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const random = seededRandom(13);
  return labels.map((label) => ({
    label,
    high: Number((random() * 30 + 40).toFixed(0)),
    medium: Number((random() * 25 + 25).toFixed(0)),
    low: Number((random() * 20 + 15).toFixed(0)),
  }));
};

export interface KpiMockData {
  completionTrend: KpiSeriesPoint[];
  overdueRate: KpiDualSeriesPoint[];
  avgCompletionTime: KpiSeriesPoint[];
  categoryDistribution: KpiCategoryPoint[];
  priorityBreakdown: KpiCategoryPoint[];
  tasksPerEmployee: KpiEmployeePoint[];
  statusOverview: KpiCategoryPoint[];
  scheduledVsCompleted: KpiDualSeriesPoint[];
  avgDelayTime: KpiSeriesPoint[];
  tasksByPet: KpiPetPoint[];
  taskTypeComparison: KpiDualSeriesPoint[];
  creationTrend: KpiSeriesPoint[];
  completionEfficiencyByPriority: KpiTripleSeriesPoint[];
}

export const generateKpiMockData = (range: KpiRange = 'today'): KpiMockData => ({
  completionTrend: generateCompletionTrend(range),
  overdueRate: generateOverdueRate(range),
  avgCompletionTime: generateAvgCompletionTime(range),
  categoryDistribution: generateCategoryDistribution(),
  priorityBreakdown: generatePriorityBreakdown(),
  tasksPerEmployee: generateTasksPerEmployee(),
  statusOverview: generateStatusOverview(),
  scheduledVsCompleted: generateScheduledVsCompleted(),
  avgDelayTime: generateAvgDelayTime(),
  tasksByPet: generateTasksByPet(),
  taskTypeComparison: generateTaskTypeComparison(),
  creationTrend: generateCreationTrend(range),
  completionEfficiencyByPriority: generateCompletionEfficiencyByPriority(),
});

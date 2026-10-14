// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchKpiDailySummary, type KpiDailySummaryFigures } from '../api/kpiApi';
import { KpiDailySummaryCard } from '../components/operation/KpiDailySummaryCard';

vi.mock('../api/kpiApi', () => ({
  fetchKpiDailySummary: vi.fn(),
}));

const FIGURES: KpiDailySummaryFigures = {
  date: '2026-09-30',
  scheduled: 42,
  completed: 1,
  completionRate: 2.4,
  overdue: 39,
  incompleteAtDayEnd: 41,
  staff: [
    { name: 'aria.singh', overdue: 25, assigned: 25 },
    { name: 'sione.tupou', overdue: 12, assigned: 12 },
    { name: 'Unassigned', overdue: 2, assigned: 4 },
    { name: 'mia.chen', overdue: 1, assigned: 3 },
    { name: 'liam.thompson', overdue: 0, assigned: 1 },
  ],
};

describe('KpiDailySummaryCard', () => {
  beforeEach(() => {
    vi.mocked(fetchKpiDailySummary).mockReset();
  });

  it('shows the figures, who needs attention and the takeaway', async () => {
    vi.mocked(fetchKpiDailySummary).mockResolvedValue({
      date: '2026-09-30',
      status: 'ready',
      text: 'None of the 42 tasks were finished.',
      figures: FIGURES,
    });

    render(<KpiDailySummaryCard />);

    expect(await screen.findByText('None of the 42 tasks were finished.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: "Yesterday's summary (30 Sep)" }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 (2.4%)')).toBeInTheDocument();
    expect(screen.queryByText(/7-day avg/)).not.toBeInTheDocument();
    expect(screen.getByText('39')).toBeInTheDocument();
    expect(
      screen.getByText('aria.singh 25/25 · sione.tupou 12/12 · Unassigned 2/4'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mia\.chen|liam\.thompson/)).not.toBeInTheDocument();
  });

  it('says when no tasks were scheduled, without figures', async () => {
    vi.mocked(fetchKpiDailySummary).mockResolvedValue({
      date: '2026-09-30',
      status: 'empty',
      text: null,
      figures: { ...FIGURES, scheduled: 0, completed: 0, staff: [] },
    });

    render(<KpiDailySummaryCard />);

    expect(await screen.findByText('No tasks were scheduled yesterday')).toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
  });

  it('says the summary is not ready when the request fails', async () => {
    vi.mocked(fetchKpiDailySummary).mockRejectedValue(new Error('503'));

    render(<KpiDailySummaryCard />);

    expect(await screen.findByText('Summary not ready yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Yesterday's summary" })).toBeInTheDocument();
  });

  it('collapses and expands the summary', async () => {
    vi.mocked(fetchKpiDailySummary).mockResolvedValue({
      date: '2026-09-30',
      status: 'ready',
      text: 'Summary text',
      figures: FIGURES,
    });

    render(<KpiDailySummaryCard />);
    await screen.findByText('Summary text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Summary text')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('Summary text')).toBeInTheDocument();
  });
});

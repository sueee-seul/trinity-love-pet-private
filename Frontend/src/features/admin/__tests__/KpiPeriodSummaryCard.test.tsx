// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchKpiPeriodSummary, type KpiPeriodSummary } from '../api/kpiPeriodSummaryApi';
import { KpiPeriodSummaryCard } from '../components/operation/KpiPeriodSummaryCard';

vi.mock('../api/kpiPeriodSummaryApi', () => ({
  fetchKpiPeriodSummary: vi.fn(),
}));

const LAST_WEEK: Pick<KpiPeriodSummary, 'range' | 'type' | 'period' | 'periodLabel'> = {
  range: '7d',
  type: 'weekly',
  period: { start: '2026-09-28', end: '2026-10-05' },
  periodLabel: '28 Sep to 4 Oct',
};

const KEY_NUMBERS = [
  {
    key: 'scheduled',
    label: 'Scheduled',
    unit: '' as const,
    current: 30,
    previous: 28,
    change: 2,
    worse: false,
  },
];

const renderCard = (): void => {
  render(
    <MemoryRouter>
      <KpiPeriodSummaryCard range="7d" />
    </MemoryRouter>,
  );
};

describe('KpiPeriodSummaryCard', () => {
  beforeEach(() => {
    vi.mocked(fetchKpiPeriodSummary).mockReset();
  });

  it('shows the saved weekly summary, its key numbers and a link to the report', async () => {
    vi.mocked(fetchKpiPeriodSummary).mockResolvedValue({
      ...LAST_WEEK,
      status: 'ready',
      reportId: 'report-1',
      headline: 'Completion improved on the week before.',
      keyNumbers: KEY_NUMBERS,
    });

    renderCard();

    expect(await screen.findByText('Completion improved on the week before.')).toBeInTheDocument();
    expect(fetchKpiPeriodSummary).toHaveBeenCalledWith('7d');
    expect(
      screen.getByRole('heading', { name: 'Last week (28 Sep to 4 Oct)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute(
      'href',
      '/admin/kpi-reports/report-1',
    );
  });

  it('shows the figures and the link when the report has no text', async () => {
    vi.mocked(fetchKpiPeriodSummary).mockResolvedValue({
      ...LAST_WEEK,
      status: 'no_text',
      reportId: 'report-2',
      headline: null,
      keyNumbers: KEY_NUMBERS,
    });

    renderCard();

    expect(await screen.findByText('No summary text for this report')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open report' })).toBeInTheDocument();
  });

  it('says the summary is not ready, without a link, when there is no report yet', async () => {
    vi.mocked(fetchKpiPeriodSummary).mockResolvedValue({
      ...LAST_WEEK,
      status: 'not_ready',
      reportId: null,
      headline: null,
      keyNumbers: [],
    });

    renderCard();

    expect(await screen.findByText('Summary not ready yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open report' })).not.toBeInTheDocument();
  });

  it('says the summary is not ready when the request fails', async () => {
    vi.mocked(fetchKpiPeriodSummary).mockRejectedValue(new Error('503'));

    renderCard();

    expect(await screen.findByText('Summary not ready yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Last week' })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchKpiReport, type KpiReport } from '../api/kpiReportsApi';
import { KpiReportPage } from '../pages/KpiReportPage';

vi.mock('../api/kpiReportsApi', () => ({
  fetchKpiReport: vi.fn(),
}));

const REPORT: KpiReport = {
  id: 'report-1',
  trigger: 'schedule',
  createdAt: '2026-09-30T20:00:00Z',
  content: {
    type: 'weekly',
    period: { start: '2026-09-21', end: '2026-09-28' },
    periodLabel: '21 Sep to 27 Sep',
    previous: { start: '2026-09-14', end: '2026-09-21' },
    previousLabel: '14 Sep to 20 Sep',
    trends: ['Overdue rate up 3 weeks in a row (5% → 8% → 11% → 14%)'],
    headline: 'Overdue rose, mostly in Walking tasks.',
    keyNumbers: [
      {
        key: 'onTimeRate',
        label: 'On-time rate',
        unit: '%',
        current: 79,
        previous: 86.2,
        change: -7.2,
        worse: true,
      },
    ],
    movers: ['Walking overdue 3 → 15'],
    staff: [{ name: 'aria.singh', scheduled: 40, completed: 36, completionRate: 90, overdue: 6 }],
    delayReasons: [{ theme: 'Weather', count: 2, example: 'Heavy rain all afternoon.' }],
    delayReasonCount: 2,
  },
};

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/admin/kpi-reports/report-1']}>
      <Routes>
        <Route path="/admin/kpi-reports/:id" element={<KpiReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('KpiReportPage', () => {
  beforeEach(() => {
    vi.mocked(fetchKpiReport).mockReset();
  });

  it('shows every section of a saved report', async () => {
    vi.mocked(fetchKpiReport).mockResolvedValue(REPORT);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Weekly KPI report' })).toBeInTheDocument();
    expect(fetchKpiReport).toHaveBeenCalledWith('report-1');
    expect(
      screen.getByText('21 Sep to 27 Sep · compared with 14 Sep to 20 Sep'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Overdue rate up 3 weeks in a row (5% → 8% → 11% → 14%)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Overdue rose, mostly in Walking tasks.')).toBeInTheDocument();
    expect(screen.getByText('▼ 7.2 pts')).toBeInTheDocument();
    expect(screen.getByText('Walking overdue 3 → 15')).toBeInTheDocument();
    expect(screen.getByText('aria.singh')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();
  });

  it('says when the report does not exist', async () => {
    vi.mocked(fetchKpiReport).mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText('This report could not be found.')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    vi.mocked(fetchKpiReport).mockRejectedValue(new Error('503'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('The report could not be loaded.');
  });
});

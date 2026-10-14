// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KpiAlertSection } from '../components/KpiAlertSection';
import type { KpiAlert } from '../api/kpiAlertsApi';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const ALERTS: KpiAlert[] = [
  {
    id: 'alert-1',
    rule: 'staff-overdue',
    title: 'aria.singh overdue 60% (3/5)',
    body: 'Walking tasks delayed',
    createdAt: '2026-10-01T01:30:00Z', // Auckland 14:30
    read: false,
    reportId: null,
  },
  {
    id: 'alert-2',
    rule: 'overdue-rate',
    title: 'Team overdue 40% (6/15)',
    body: '',
    createdAt: '2026-10-01T01:00:00Z',
    read: true,
    reportId: null,
  },
];

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof KpiAlertSection>> = {},
): { markRead: ReturnType<typeof vi.fn>; readAll: ReturnType<typeof vi.fn> } => {
  const markRead = vi.fn().mockResolvedValue(undefined);
  const readAll = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <KpiAlertSection
              alerts={ALERTS}
              unreadCount={1}
              loadStatus="loaded"
              markRead={markRead}
              readAll={readAll}
              {...overrides}
            />
          }
        />
        <Route path="/admin/operation" element={<p>Notifications tab</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { markRead, readAll };
};

describe('KpiAlertSection', () => {
  it('shows alerts with their Auckland time', () => {
    renderSection();

    expect(screen.getByText('aria.singh overdue 60% (3/5)')).toBeInTheDocument();
    expect(screen.getByText('Walking tasks delayed')).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('marks an unread alert read when clicked', () => {
    const { markRead } = renderSection();
    fireEvent.click(screen.getByText('aria.singh overdue 60% (3/5)'));
    expect(markRead).toHaveBeenCalledWith('alert-1');
  });

  it('does not mark a read alert again when clicked', () => {
    const { markRead } = renderSection();
    fireEvent.click(screen.getByText('Team overdue 40% (6/15)'));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('reads all KPI alerts, and disables the button when nothing is unread', () => {
    const { readAll } = renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Read all KPI alerts' }));
    expect(readAll).toHaveBeenCalledTimes(1);
  });

  it('disables Read all when nothing is unread', () => {
    renderSection({ unreadCount: 0 });

    expect(screen.getByRole('button', { name: 'Read all KPI alerts' })).toBeDisabled();
  });

  it('shows an empty state', () => {
    renderSection({ alerts: [], unreadCount: 0 });

    expect(screen.getByText('No KPI alerts')).toBeInTheDocument();
  });

  it('opens the notifications tab when a KPI alert is clicked', () => {
    const { markRead } = renderSection({
      alerts: [
        {
          id: 'alert-3',
          rule: 'report-ready',
          title: 'Weekly report ready (21 Sep to 27 Sep)',
          body: 'Overdue rose this week.',
          createdAt: '2026-10-01T01:30:00Z',
          read: false,
          reportId: 'report-1',
        },
      ],
    });

    fireEvent.click(screen.getByText('Weekly report ready (21 Sep to 27 Sep)'));

    expect(markRead).toHaveBeenCalledWith('alert-3');
    expect(screen.getByText('Notifications tab')).toBeInTheDocument();
  });
});

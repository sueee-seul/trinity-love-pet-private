import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseDate, getCalendarDayButton } from '../../../../../shared/components/ui/date/testing';
import { toInquiryCalendarDate } from '../../../utils/inquiryTime';
import { InquiryRail } from '../InquiryRail';

const NOW = new Date('2026-06-15T12:00:00.000Z');
// Derived the same way the component derives "today", so this test is immune to the runner's
// own timezone (a fixed UTC string can land on a different local calendar date).
const TODAY = toInquiryCalendarDate(NOW.toISOString());
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TOMORROW = toInquiryCalendarDate(new Date(NOW.getTime() + ONE_DAY_MS).toISOString());

const baseProps = {
  tab: 'Active' as const,
  onTabChange: vi.fn(),
  counts: { active: 3, closed: 2 },
  supportStatusFilter: 'All' as const,
  onSupportStatusFilterChange: vi.fn(),
  dateFrom: '',
  onDateFromChange: vi.fn(),
  dateTo: '',
  onDateToChange: vi.fn(),
  assigneeId: 'All',
  onAssigneeIdChange: vi.fn(),
  assigneeOptions: [{ id: 'staff-1', name: 'Alice' }],
  parentNameQuery: '',
  onParentNameQueryChange: vi.fn(),
  topicQuery: '',
  onTopicQueryChange: vi.fn(),
  durationMin: null,
  onDurationMinChange: vi.fn(),
  durationMax: null,
  onDurationMaxChange: vi.fn(),
  notesFilter: 'All' as const,
  onNotesFilterChange: vi.fn(),
};

beforeEach(() => {
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('InquiryRail: manager-only controls', () => {
  it('shows the "All Assignees" filter and hides the banner for a manager', () => {
    render(<InquiryRail {...baseProps} isManager />);
    expect(screen.getByRole('combobox', { name: 'Filter by assignee' })).toBeInTheDocument();
    expect(
      screen.queryByText("You're seeing conversations assigned to you."),
    ).not.toBeInTheDocument();
  });

  it('hides the "All Assignees" filter and shows the banner for a non-manager', () => {
    render(<InquiryRail {...baseProps} isManager={false} />);
    expect(screen.queryByRole('combobox', { name: 'Filter by assignee' })).not.toBeInTheDocument();
    expect(screen.getByText("You're seeing conversations assigned to you.")).toBeInTheDocument();
  });
});

describe('InquiryRail: date range', () => {
  it('blocks days after today in the From calendar', async () => {
    const user = userEvent.setup();
    render(<InquiryRail {...baseProps} isManager />);

    await user.click(screen.getByRole('button', { name: 'Date range from' }));

    expect(getCalendarDayButton(TODAY)).toBeEnabled();
    expect(getCalendarDayButton(TOMORROW)).toBeDisabled();
  });

  it('blocks days after dateTo in the From calendar when dateTo is earlier than today', async () => {
    const user = userEvent.setup();
    render(<InquiryRail {...baseProps} isManager dateTo="2026-06-10" />);

    await user.click(screen.getByRole('button', { name: 'Date range from' }));

    expect(getCalendarDayButton('2026-06-10')).toBeEnabled();
    expect(getCalendarDayButton('2026-06-11')).toBeDisabled();
  });

  it('blocks days after today in the To calendar', async () => {
    const user = userEvent.setup();
    render(<InquiryRail {...baseProps} isManager />);

    await user.click(screen.getByRole('button', { name: 'Date range to' }));

    expect(getCalendarDayButton(TODAY)).toBeEnabled();
    expect(getCalendarDayButton(TOMORROW)).toBeDisabled();
  });

  it('passes a picked From and To date on to the page', async () => {
    const user = userEvent.setup();
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();
    render(
      <InquiryRail
        {...baseProps}
        isManager
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
      />,
    );

    await chooseDate(user, screen.getByRole('button', { name: 'Date range from' }), '2026-06-01');
    await chooseDate(user, screen.getByRole('button', { name: 'Date range to' }), '2026-06-05');

    expect(onDateFromChange).toHaveBeenCalledWith('2026-06-01');
    expect(onDateToChange).toHaveBeenCalledWith('2026-06-05');
  });

  it('shows "Clear dates" only when a bound is set, and it resets both fields', async () => {
    const user = userEvent.setup();
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();
    const { rerender } = render(<InquiryRail {...baseProps} isManager />);
    expect(screen.queryByRole('button', { name: 'Clear dates' })).not.toBeInTheDocument();

    rerender(
      <InquiryRail
        {...baseProps}
        isManager
        dateFrom="2026-06-01"
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear dates' }));

    expect(onDateFromChange).toHaveBeenCalledWith('');
    expect(onDateToChange).toHaveBeenCalledWith('');
  });
});

describe('InquiryRail: duration range', () => {
  it('clamps a min above the current max down to the max', () => {
    const onDurationMinChange = vi.fn();
    render(
      <InquiryRail
        {...baseProps}
        isManager
        durationMax={20}
        onDurationMinChange={onDurationMinChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Minimum duration in minutes'), {
      target: { value: '30' },
    });

    expect(onDurationMinChange).toHaveBeenCalledWith(20);
  });

  it('clamps a max below the current min up to the min', () => {
    const onDurationMaxChange = vi.fn();
    render(
      <InquiryRail
        {...baseProps}
        isManager
        durationMin={10}
        onDurationMaxChange={onDurationMaxChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Maximum duration in minutes'), {
      target: { value: '5' },
    });

    expect(onDurationMaxChange).toHaveBeenCalledWith(10);
  });

  it('shows "Clear duration" only when a bound is set, and it resets both fields', async () => {
    const user = userEvent.setup();
    const onDurationMinChange = vi.fn();
    const onDurationMaxChange = vi.fn();
    const { rerender } = render(<InquiryRail {...baseProps} isManager />);
    expect(screen.queryByRole('button', { name: 'Clear duration' })).not.toBeInTheDocument();

    rerender(
      <InquiryRail
        {...baseProps}
        isManager
        durationMin={5}
        onDurationMinChange={onDurationMinChange}
        onDurationMaxChange={onDurationMaxChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear duration' }));

    expect(onDurationMinChange).toHaveBeenCalledWith(null);
    expect(onDurationMaxChange).toHaveBeenCalledWith(null);
  });
});

describe('InquiryRail: tabs', () => {
  it('calls onTabChange with the clicked tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<InquiryRail {...baseProps} isManager onTabChange={onTabChange} />);

    await user.click(screen.getByRole('button', { name: /Closed/ }));

    expect(onTabChange).toHaveBeenCalledWith('Closed');
  });
});

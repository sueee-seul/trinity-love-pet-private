import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DateField, type DateFieldProps } from '../DateField';
import { chooseDate, getCalendarDayButton, getOpenCalendar } from '../testing';

type HarnessProps = Omit<DateFieldProps, 'value' | 'onChange'> & {
  initial?: string;
  onValue?: (value: string) => void;
};

function Harness({ initial = '', onValue, ...fieldProps }: HarnessProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <form aria-label="Booking">
      <label htmlFor="check-in">Check-in</label>
      <DateField
        id="check-in"
        name="checkIn"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        {...fieldProps}
      />
    </form>
  );
}

const getTrigger = (name = 'Check-in'): HTMLElement => screen.getByRole('button', { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DateField', () => {
  it('shows English text and months even when the browser language is Chinese', async () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-CN');
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" />);

    expect(getTrigger()).toHaveTextContent('Mon 12 Oct 2026');
    await user.click(getTrigger());

    const calendar = within(getOpenCalendar());
    expect(calendar.getByText('October 2026')).toBeInTheDocument();
    // The weekday row is aria-hidden, so it is read from the DOM. Weeks start on Monday.
    expect(getOpenCalendar().querySelector('th')).toHaveTextContent('Mo');
    expect(calendar.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the placeholder when there is no date', () => {
    render(<Harness />);
    expect(getTrigger()).toHaveTextContent('Choose a date');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('writes the picked day as YYYY-MM-DD, closes and returns focus to the trigger', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<Harness onValue={onValue} />);

    await chooseDate(user, getTrigger(), '2026-10-12');

    expect(onValue).toHaveBeenLastCalledWith('2026-10-12');
    expect(getTrigger()).toHaveTextContent('Mon 12 Oct 2026');
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(getTrigger()).toHaveFocus();
    expect(container.querySelector('input[type="hidden"][name="checkIn"]')).toHaveValue(
      '2026-10-12',
    );
  });

  it('disables days outside min and max', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-15" min="2026-10-10" max="2026-10-20" />);
    await user.click(getTrigger());

    expect(getCalendarDayButton('2026-10-09')).toBeDisabled();
    expect(getCalendarDayButton('2026-10-10')).toBeEnabled();
    expect(getCalendarDayButton('2026-10-20')).toBeEnabled();
    expect(getCalendarDayButton('2026-10-21')).toBeDisabled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" onValue={onValue} />);

    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');

    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(getTrigger()).toHaveFocus();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('shows Chinese text and month names for the zh locale', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" locale="zh" />);

    expect(getTrigger()).toHaveTextContent('2026年10月12日 周一');
    await user.click(getTrigger());

    const calendar = within(getOpenCalendar());
    expect(calendar.getByText('2026年10月')).toBeInTheDocument();
    expect(getOpenCalendar().querySelector('th')).toHaveTextContent('一');
    expect(calendar.getByRole('button', { name: '清除' })).toBeInTheDocument();
    expect(calendar.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('clears the value with Clear', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" onValue={onValue} />);

    await user.click(getTrigger());
    await user.click(within(getOpenCalendar()).getByRole('button', { name: 'Clear' }));

    expect(onValue).toHaveBeenLastCalledWith('');
    expect(getTrigger()).toHaveTextContent('Choose a date');
  });

  it('has no Clear button when required', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" required />);

    await user.click(getTrigger());

    expect(within(getOpenCalendar()).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('picks a date years away with the month and year dropdowns', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} yearPicker max="2026-09-28" dialogLabel="Birth date" />);

    await chooseDate(user, getTrigger(), '2019-03-05');

    expect(onValue).toHaveBeenLastCalledWith('2019-03-05');
  });

  it('hides the library label next to each dropdown so month and year show once', async () => {
    const user = userEvent.setup();
    render(<Harness yearPicker max="2026-09-28" dialogLabel="Birth date" />);

    await user.click(getTrigger());

    const dropdowns = getOpenCalendar().querySelectorAll('select');
    expect(dropdowns.length).toBe(2);
    dropdowns.forEach((select) => {
      // The label sits next to the select inside the dropdown root; the root hides it.
      expect(select.parentElement?.className).toContain('[&>span]:hidden');
      expect(select.parentElement?.querySelector(':scope > span')).not.toBeNull();
    });
  });

  it('names the dialog with dialogLabel', async () => {
    const user = userEvent.setup();
    render(<Harness dialogLabel="Pick your check-in day" />);

    await user.click(getTrigger());

    expect(screen.getByRole('dialog', { name: 'Pick your check-in day' })).toBeInTheDocument();
  });
});

describe('DateField in New Zealand time', () => {
  const originalTimeZone = process.env.TZ;

  // Set only around these tests and put back after, so no other file runs in New Zealand time.
  beforeAll(() => {
    process.env.TZ = 'Pacific/Auckland';
  });

  afterAll(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it('keeps the picked day although its local midnight is the day before in UTC', async () => {
    // The calendar hands over local midnight. In UTC+13 that instant is 11:00 the day before,
    // so a value built with toISOString() would come out as 2026-10-31.
    expect(new Date(2026, 10, 1).toISOString().slice(0, 10)).toBe('2026-10-31');
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await chooseDate(user, getTrigger(), '2026-11-01');

    expect(onValue).toHaveBeenLastCalledWith('2026-11-01');
    expect(getTrigger()).toHaveTextContent('Sun 1 Nov 2026');
  });
});

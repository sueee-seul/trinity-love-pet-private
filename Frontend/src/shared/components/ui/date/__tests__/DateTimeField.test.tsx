import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DateTimeField, type DateTimeFieldProps } from '../DateTimeField';
import { chooseDate, chooseTime } from '../testing';

type HarnessProps = Omit<DateTimeFieldProps, 'value' | 'onChange'> & {
  initial?: string;
  onValue?: (value: string) => void;
};

function Harness({ initial = '', onValue, ...fieldProps }: HarnessProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="visit">Visit</label>
      <DateTimeField
        id="visit"
        name="visitAt"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        {...fieldProps}
      />
    </>
  );
}

const getDateTrigger = (): HTMLElement => screen.getByRole('button', { name: 'Visit' });
const getTimeSelect = (name = 'Time'): HTMLElement => screen.getByRole('combobox', { name });

describe('DateTimeField', () => {
  it('splits the value into its date and time parts', () => {
    render(<Harness initial="2026-10-12T09:30" />);

    expect(getDateTrigger()).toHaveAttribute('id', 'visit');
    expect(getDateTrigger()).toHaveTextContent('Mon 12 Oct 2026');
    expect(getTimeSelect()).toHaveAttribute('id', 'visit-time');
    expect(getTimeSelect()).toHaveValue('09:30');
  });

  it('combines a changed part into YYYY-MM-DDTHH:mm', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12T09:30" onValue={onValue} />);

    await chooseTime(user, getTimeSelect(), '10:00');
    expect(onValue).toHaveBeenLastCalledWith('2026-10-12T10:00');

    await chooseDate(user, getDateTrigger(), '2026-10-14');
    expect(onValue).toHaveBeenLastCalledWith('2026-10-14T10:00');
  });

  it('keeps a date picked before the time and reports only the whole value', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await chooseDate(user, getDateTrigger(), '2026-10-12');
    expect(onValue).not.toHaveBeenCalled();
    expect(getDateTrigger()).toHaveTextContent('Mon 12 Oct 2026');

    await chooseTime(user, getTimeSelect(), '14:00');
    expect(onValue).toHaveBeenLastCalledWith('2026-10-12T14:00');
  });

  it('carries the combined value in a hidden input', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initial="2026-10-12T09:30" />);
    const hidden = container.querySelector('input[type="hidden"][name="visitAt"]');

    expect(hidden).toHaveValue('2026-10-12T09:30');
    await chooseTime(user, getTimeSelect(), '11:00');
    expect(hidden).toHaveValue('2026-10-12T11:00');
  });

  it('names the time part in Chinese for the zh locale', () => {
    render(<Harness initial="2026-10-12T09:30" locale="zh" />);

    expect(getTimeSelect('时间')).toHaveValue('09:30');
    expect(getDateTrigger()).toHaveTextContent('2026年10月12日 周一');
  });

  it('gives both parts the compact field classes', () => {
    render(<Harness initial="2026-10-12T09:30" fieldClassName="compact-field" />);

    expect(getDateTrigger()).toHaveClass('compact-field');
    expect(getTimeSelect('Time')).toHaveClass('compact-field');
  });
});

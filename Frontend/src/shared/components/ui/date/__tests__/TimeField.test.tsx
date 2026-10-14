import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeField, type TimeFieldProps } from '../TimeField';
import { chooseTime } from '../testing';

type HarnessProps = Omit<TimeFieldProps, 'value' | 'onChange'> & {
  initial?: string;
  onValue?: (value: string) => void;
};

function Harness({ initial = '', onValue, ...fieldProps }: HarnessProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="drop-off">Drop-off time</label>
      <TimeField
        id="drop-off"
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

const getSelect = (): HTMLSelectElement =>
  screen.getByRole('combobox', { name: 'Drop-off time' }) as HTMLSelectElement;

describe('TimeField', () => {
  it('lists English labels with HH:mm values and a placeholder', () => {
    render(<Harness from="09:00" to="10:00" />);

    const options = within(getSelect()).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((option) => [option.value, option.textContent])).toEqual([
      ['', 'Choose a time'],
      ['09:00', '9:00 am'],
      ['09:30', '9:30 am'],
      ['10:00', '10:00 am'],
    ]);
  });

  it('lists Chinese labels for the zh locale', () => {
    render(<Harness locale="zh" from="09:00" to="13:00" stepMinutes={240} />);

    expect(within(getSelect()).getByRole('option', { name: '上午9:00' })).toHaveValue('09:00');
    expect(within(getSelect()).getByRole('option', { name: '下午1:00' })).toHaveValue('13:00');
    expect(within(getSelect()).getByRole('option', { name: '选择时间' })).toHaveValue('');
  });

  it('keeps an off-grid value as an extra selected option', () => {
    render(<Harness initial="09:15" from="09:00" to="10:00" />);

    expect(getSelect()).toHaveValue('09:15');
    expect(within(getSelect()).getByRole('option', { name: '9:15 am' })).toBeInTheDocument();
  });

  it('reports the chosen time as HH:mm', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);

    await chooseTime(user, getSelect(), '14:30');

    expect(onValue).toHaveBeenLastCalledWith('14:30');
    expect(getSelect()).toHaveValue('14:30');
  });

  it('carries the name for a native form', () => {
    render(<Harness name="dropOff" initial="09:00" />);
    expect(getSelect()).toHaveAttribute('name', 'dropOff');
  });
});

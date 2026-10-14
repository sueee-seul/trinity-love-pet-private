// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { chooseDate, chooseTime } from '../../../../../shared/components/ui/date/testing';
import { ShiftFormFields } from '../ShiftFormFields';
import { EMPTY_DRAFT } from '../shiftDraft';

const staff = [{ id: 'staff-1', name: 'Alice', staff_status: 'active' }];

describe('ShiftFormFields', () => {
  it('patches the draft with the picked date and times', async () => {
    const user = userEvent.setup();
    const onPatch = vi.fn();
    render(<ShiftFormFields draft={EMPTY_DRAFT} staff={staff} onPatch={onPatch} />);

    await chooseDate(user, screen.getByRole('button', { name: 'Date' }), '2026-10-12');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Start *' }), '05:15');
    await chooseTime(user, screen.getByRole('combobox', { name: 'Finish *' }), '23:45');

    expect(onPatch).toHaveBeenCalledWith({ date: '2026-10-12' });
    expect(onPatch).toHaveBeenCalledWith({ start: '05:15' });
    expect(onPatch).toHaveBeenCalledWith({ finish: '23:45' });
  });

  it('offers the whole day in quarter hours, since shifts can start early or end late', () => {
    render(<ShiftFormFields draft={EMPTY_DRAFT} staff={staff} onPatch={vi.fn()} />);

    const finish = screen.getByRole('combobox', { name: 'Finish *' });
    const values = Array.from(finish.querySelectorAll('option'), (option) => option.value);

    expect(values[0]).toBe('');
    expect(values[1]).toBe('00:00');
    expect(values[2]).toBe('00:15');
    expect(values.at(-1)).toBe('23:45');
  });
});

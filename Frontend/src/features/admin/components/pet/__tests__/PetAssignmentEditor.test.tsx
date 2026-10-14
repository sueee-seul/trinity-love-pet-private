// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseDate, chooseTime } from '../../../../../shared/components/ui/date/testing';
import { PetAssignmentEditor } from '../PetAssignmentEditor';
import type { PetAssignment } from '../../../types/pet';

const staffOptions = [
  { id: 'employee-1', name: 'Bob Staff' },
  { id: 'employee-2', name: 'Charlie Staff' },
];

const assignment: PetAssignment = {
  uuid: 'assignment-1',
  petUuid: 'pet-1',
  petName: 'Sherlock',
  employeeUuid: 'employee-1',
  employeeName: 'Bob Staff',
  assignmentDate: '2026-08-30',
  shiftStart: '08:00:00',
  shiftEnd: '16:00:00',
};

const renderEditor = (
  overrides: Partial<React.ComponentProps<typeof PetAssignmentEditor>> = {},
): void => {
  render(
    <PetAssignmentEditor
      assignments={[]}
      staffOptions={staffOptions}
      loading={false}
      error={null}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PetAssignmentEditor', () => {
  it('requires staff, date, and shift before enabling a timed assignment', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: 'Add assignment' })).toBeDisabled();
  });

  it('creates a dated shift assignment through the dedicated callback', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onCreate });

    await user.selectOptions(screen.getByLabelText('Assignment staff'), 'employee-1');
    await chooseDate(user, screen.getByRole('button', { name: 'Assignment date' }), '2026-08-30');
    await chooseTime(
      user,
      screen.getByRole('combobox', { name: 'Assignment shift start' }),
      '08:00',
    );
    await chooseTime(user, screen.getByRole('combobox', { name: 'Assignment shift end' }), '16:00');
    await user.click(screen.getByRole('button', { name: 'Add assignment' }));

    expect(onCreate).toHaveBeenCalledWith({
      employeeUuid: 'employee-1',
      assignmentDate: '2026-08-30',
      shiftStart: '08:00',
      shiftEnd: '16:00',
    });
  });

  it('offers the whole day in quarter hours, so early and late shifts can be set', () => {
    renderEditor();

    const start = screen.getByRole('combobox', { name: 'Assignment shift start' });
    const values = Array.from(start.querySelectorAll('option'), (option) => option.value);

    expect(values).toContain('00:00');
    expect(values).toContain('05:15');
    expect(values).toContain('23:45');
  });

  it('supports all-day assignments with both shift values null', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onCreate });

    await user.selectOptions(screen.getByLabelText('Assignment staff'), 'employee-2');
    await chooseDate(user, screen.getByRole('button', { name: 'Assignment date' }), '2026-08-31');
    await user.click(screen.getByLabelText('All day assignment'));
    await user.click(screen.getByRole('button', { name: 'Add assignment' }));

    expect(onCreate).toHaveBeenCalledWith({
      employeeUuid: 'employee-2',
      assignmentDate: '2026-08-31',
      shiftStart: null,
      shiftEnd: null,
    });
  });

  it('asks for confirmation before deleting a persisted assignment', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    renderEditor({ assignments: [assignment], onDelete });

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(confirm).toHaveBeenCalledWith('Remove this pet assignment?');
    expect(onDelete).toHaveBeenCalledWith('assignment-1');
  });
});

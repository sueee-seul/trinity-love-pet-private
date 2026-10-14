// @vitest-environment jsdom
import { useState, type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { chooseDate, chooseTime } from '../../../../../shared/components/ui/date/testing';
import { TaskEditorFields } from '../TaskEditorFields';

// The time is held in state here, as the task form does, so the field sees its own value echoed back.
function Harness({ onTimeChange }: { onTimeChange: (value: string) => void }): ReactElement {
  const [time, setTime] = useState('');
  return (
    <TaskEditorFields
      templates={[]}
      assignments={[]}
      templateId=""
      taskType="staff"
      customTitle=""
      status="pending"
      priority="mid"
      time={time}
      assignmentId=""
      issue=""
      description=""
      onTemplateChange={vi.fn()}
      onTaskTypeChange={vi.fn()}
      onTitleChange={vi.fn()}
      onStatusChange={vi.fn()}
      onPriorityChange={vi.fn()}
      onTimeChange={(value) => {
        setTime(value);
        onTimeChange(value);
      }}
      onAssignmentChange={vi.fn()}
      onIssueChange={vi.fn()}
      onDescriptionChange={vi.fn()}
    />
  );
}

describe('TaskEditorFields', () => {
  it('sends one due time once both the date and the time are picked', async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();
    render(<Harness onTimeChange={onTimeChange} />);

    await chooseDate(user, screen.getByRole('button', { name: 'Choose a date' }), '2026-10-12');
    expect(onTimeChange).not.toHaveBeenCalled();

    await chooseTime(user, screen.getByRole('combobox', { name: 'Time' }), '09:10');
    expect(onTimeChange).toHaveBeenLastCalledWith('2026-10-12T09:10');
  });

  it('offers task times on the ten minute grid', () => {
    render(<Harness onTimeChange={vi.fn()} />);

    const time = screen.getByRole('combobox', { name: 'Time' });
    const values = Array.from(time.querySelectorAll('option'), (option) => option.value);

    expect(values.slice(1, 4)).toEqual(['00:00', '00:10', '00:20']);
  });
});

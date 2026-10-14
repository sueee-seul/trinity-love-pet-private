import type { ReactElement } from 'react';
import { DateTimeField } from '../../../../shared/components/ui/date';
import {
  snapTimeInputTo10,
  type Task,
  type TaskAssignment,
  type TaskTemplate,
} from '../../types/task.types';

export type TaskEditorFieldValues = {
  templates: TaskTemplate[];
  assignments: TaskAssignment[];
  templateId: string;
  taskType: Task['task_type'];
  customTitle: string;
  status: Task['status'];
  priority: Task['priority'];
  time: string;
  assignmentId: string;
  issue: string;
  description: string;
  onTemplateChange: (value: string) => void;
  onTaskTypeChange: (value: Task['task_type']) => void;
  onTitleChange: (value: string) => void;
  onStatusChange: (value: Task['status']) => void;
  onPriorityChange: (value: Task['priority']) => void;
  onTimeChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
  onIssueChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

const fieldClass = 'rounded border border-field-border p-2 type-meta';
// Task times are kept on a ten minute grid, the same grid snapTimeInputTo10 rounds to.
const TASK_STEP_MINUTES = 10;

export function TaskEditorFields({
  templates,
  assignments,
  templateId,
  taskType,
  customTitle,
  status,
  priority,
  time,
  assignmentId,
  issue,
  description,
  onTemplateChange,
  onTaskTypeChange,
  onTitleChange,
  onStatusChange,
  onPriorityChange,
  onTimeChange,
  onAssignmentChange,
  onIssueChange,
  onDescriptionChange,
}: TaskEditorFieldValues): ReactElement {
  return (
    <>
      <select
        value={taskType}
        onChange={(event) => onTaskTypeChange(event.target.value as Task['task_type'])}
        className={fieldClass}
      >
        <option value="staff">Staff task</option>
        <option value="pet">Pet task</option>
      </select>
      <select
        value={templateId}
        onChange={(event) => onTemplateChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">Select task</option>
        {templates.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title} · {item.category}
          </option>
        ))}
        <option value="other">+ Other</option>
      </select>
      {(!templateId || templateId === 'other') && (
        <input
          value={customTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Custom task"
          className={fieldClass}
        />
      )}
      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as Task['status'])}
        className={fieldClass}
      >
        <option>pending</option>
        <option>in_progress</option>
        <option>completed</option>
        <option>cancelled</option>
      </select>
      <select
        value={priority}
        onChange={(event) => onPriorityChange(event.target.value as Task['priority'])}
        className={fieldClass}
      >
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="mid">Mid</option>
        <option value="low">Low</option>
      </select>
      <DateTimeField
        locale="en"
        stepMinutes={TASK_STEP_MINUTES}
        fieldClassName={fieldClass}
        value={time}
        onChange={(value) => onTimeChange(snapTimeInputTo10(value))}
      />
      <select
        value={assignmentId}
        onChange={(event) => onAssignmentChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">Assigned staff</option>
        {assignments.map((item) => (
          <option key={item.assignment_id} value={item.assignment_id}>
            {item.staff_name}
            {item.shift_start && item.shift_end
              ? ` (${item.shift_start.slice(0, 5)} to ${item.shift_end.slice(0, 5)})`
              : ''}
          </option>
        ))}
      </select>
      <input
        value={issue}
        onChange={(event) => onIssueChange(event.target.value)}
        placeholder="Issue"
        className={`${fieldClass} sm:col-span-2`}
      />
      <textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Description"
        rows={2}
        className={`${fieldClass} sm:col-span-2`}
      />
    </>
  );
}

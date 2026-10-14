import type { ReactElement } from 'react';
import type { Task, TaskAssignment, TaskTemplate } from '../../types/task.types';
import { TaskEditorForm } from './TaskEditorForm';
import { useTaskEditor } from './useTaskEditor';

type TaskEditorProps = {
  petId: string;
  task: Task | null;
  defaultDate?: string;
  templates: TaskTemplate[];
  assignments: TaskAssignment[];
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onAssignmentsChange: (assignments: TaskAssignment[]) => void;
};

export function TaskEditor({
  petId,
  task,
  defaultDate,
  templates,
  assignments,
  onClose,
  onSaved,
  onDeleted,
  onAssignmentsChange,
}: TaskEditorProps): ReactElement {
  const editor = useTaskEditor({
    petId,
    task,
    defaultDate,
    templates,
    onSaved,
    onDeleted,
    onAssignmentsChange,
  });

  return (
    <TaskEditorForm
      task={task}
      templates={editor.templates}
      assignments={assignments}
      templateId={editor.templateId}
      taskType={editor.taskType}
      customTitle={editor.customTitle}
      status={editor.status}
      priority={editor.priority}
      time={editor.time}
      assignmentId={editor.staffId}
      issue={editor.issue}
      description={editor.description}
      canSave={editor.canSave}
      onTemplateChange={(value) => {
        editor.setTemplateId(value);
        if (value !== 'other') editor.setCustomTitle('');
      }}
      onTaskTypeChange={editor.setTaskType}
      onTitleChange={editor.setCustomTitle}
      onStatusChange={editor.setStatus}
      onPriorityChange={editor.setPriority}
      onTimeChange={editor.setTime}
      onAssignmentChange={editor.setStaffId}
      onIssueChange={editor.setIssue}
      onDescriptionChange={editor.setDescription}
      onClose={onClose}
      onDelete={editor.remove}
      onSave={editor.save}
    />
  );
}

import * as repository from '../repositories/task.repository.js';
import { TaskServiceError, type TaskInput, type TaskUpdate } from './task.service.base.js';
import {
  assertSlotAvailable,
  assertStaffFree,
  assertStaffOnShift,
  assertWithinStay,
  assertNotInPast,
} from './task.scheduling.service.js';
import { publishTaskEvent } from './livecare.events.js';

// createTask
export const createTask = async (
  petId: string,
  input: TaskInput,
): Promise<Awaited<ReturnType<typeof repository.findTaskWithDetails>>> => {
  let taskId: string;

  await assertNotInPast(input.dueDatetime);
  await assertWithinStay(petId, input.dueDatetime);

  if (input.assignmentId) {
    await assertSlotAvailable(input.assignmentId, petId, input.dueDatetime, null);
    const inserted = await repository.insertTask([
      petId,
      input.assignmentId,
      input.templateId ?? null,
      input.title.trim(),
      input.taskType,
      input.priority,
      input.dueDatetime,
      input.description?.trim() || null,
      input.issue?.trim() || null,
    ]);
    taskId = inserted.rows[0].uuid;
  } else if (input.staffId) {
    await assertStaffOnShift(input.staffId, input.dueDatetime);
    await assertStaffFree(input.staffId, input.dueDatetime, null);
    const inserted = await repository.insertAdHocTask([
      petId,
      input.staffId,
      input.templateId ?? null,
      input.title.trim(),
      input.taskType,
      input.priority,
      input.dueDatetime,
      input.description?.trim() || null,
      input.issue?.trim() || null,
    ]);
    taskId = inserted.rows[0].uuid;
  } else {
    throw new TaskServiceError('assignmentId or staffId is required');
  }

  publishTaskEvent(petId);
  return repository.findTaskWithDetails(taskId);
};

export const updateTask = async (
  taskId: string,
  input: TaskUpdate,
): Promise<Awaited<ReturnType<typeof repository.findTaskWithDetails>>> => {
  const current = await repository.findTask(taskId);
  if (!current.rows[0]) throw new TaskServiceError('Task not found', 404);
  if (input.dueDatetime !== undefined) await assertNotInPast(input.dueDatetime);
  if (input.dueDatetime !== undefined)
    await assertWithinStay(current.rows[0].pet_uuid, input.dueDatetime);
  if (input.assignmentId !== undefined) {
    // Caller explicitly wants this task linked to a specific pet-assignment slot.
    const dueDatetime = input.dueDatetime ?? current.rows[0].scheduled_at;
    await assertSlotAvailable(input.assignmentId, current.rows[0].pet_uuid, dueDatetime, taskId);
  } else if (input.staffId !== undefined) {
    // Caller picked a staff member directly (ad-hoc edit); make sure that staff
    // member is on shift and isn't double-booked at the task's effective time.
    const dueDatetime = input.dueDatetime ?? current.rows[0].scheduled_at;
    await assertStaffOnShift(input.staffId, dueDatetime);
    await assertStaffFree(input.staffId, dueDatetime, taskId);
  } else if (input.dueDatetime !== undefined) {
    // Plain edit of an existing (usually ad-hoc) task: just make sure the
    // already-assigned staff member isn't double-booked at the new time.
    await assertStaffFree(current.rows[0].employees_uuid, input.dueDatetime, taskId);
  }
  const updated = await repository.updateTaskRecord(taskId, [
    typeof input.title === 'string' ? input.title.trim() : null,
    input.taskType ?? null,
    input.priority ?? null,
    input.dueDatetime ?? null,
    input.status ?? null,
    typeof input.description === 'string' ? input.description.trim() : null,
    typeof input.issue === 'string' ? input.issue.trim() : null,
    input.assignmentId ?? null,
    input.staffId ?? null,
  ]);
  if (!updated.rows[0]) throw new TaskServiceError('Task not found', 404);
  publishTaskEvent(current.rows[0].pet_uuid);
  return repository.findTaskWithDetails(taskId);
};

export const completeTask = async (
  taskId: string,
): Promise<Awaited<ReturnType<typeof repository.findTaskWithDetails>>> => {
  const current = await repository.findTaskWithDetails(taskId);
  const row = current.rows[0];
  if (!row) throw new TaskServiceError('Task not found', 404);
  if (row.overdue && !String(row.issue ?? '').trim()) {
    throw new TaskServiceError('Cannot complete an overdue task without an issue description', 400);
  }
  await repository.completeTaskRecord(taskId);
  const result = await repository.findTaskWithDetails(taskId);
  if (!result.rows[0]) throw new TaskServiceError('Task not found', 404);
  publishTaskEvent(result.rows[0].pet_id);
  return result;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const current = await repository.findTask(taskId);
  if (!current.rows[0]) throw new TaskServiceError('Task not found', 404);
  const result = await repository.deleteTaskRecord(taskId);
  if (!result.rows[0]) throw new TaskServiceError('Task not found', 404);
  publishTaskEvent(current.rows[0].pet_uuid);
};

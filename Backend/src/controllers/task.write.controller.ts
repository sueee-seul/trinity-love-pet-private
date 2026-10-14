import type { Request, Response } from 'express';
import * as service from '../services/task.service.js';
import {
  isUuid,
  validDate,
  priorities,
  statuses,
  taskTypes,
  type Priority,
  type Status,
  type TaskType,
} from '../modules/tasks/task.types.js';
import { badRequest, uuidParam, handleError } from './task.controller.helpers.js';

export async function createTask(req: Request, res: Response): Promise<void> {
  const petId = uuidParam(req.params.petId);
  const body = req.body as Record<string, unknown>;
  const {
    assignmentId,
    staffId,
    templateId,
    title,
    taskType = 'staff',
    priority = 'mid',
    dueDatetime,
    description,
    issue,
  } = body;
  if (
    !petId ||
    (!assignmentId && !staffId) ||
    (assignmentId !== undefined && (typeof assignmentId !== 'string' || !isUuid(assignmentId))) ||
    (staffId !== undefined && (typeof staffId !== 'string' || !isUuid(staffId))) ||
    typeof title !== 'string' ||
    !title.trim() ||
    (templateId !== undefined && (typeof templateId !== 'string' || !isUuid(templateId))) ||
    typeof taskType !== 'string' ||
    !taskTypes.includes(taskType as TaskType) ||
    typeof priority !== 'string' ||
    !priorities.includes(priority as Priority) ||
    !validDate(dueDatetime) ||
    (description !== undefined && typeof description !== 'string') ||
    (issue !== undefined && typeof issue !== 'string')
  )
    return badRequest(
      res,
      'assignmentId or staffId, title, priority, and dueDatetime must be valid',
    );
  try {
    const result = await service.createTask(petId, {
      assignmentId: assignmentId as string | undefined,
      staffId: staffId as string | undefined,
      templateId: templateId as string | undefined,
      title,
      taskType: taskType as TaskType,
      priority: priority as Priority,
      dueDatetime: (dueDatetime as string | undefined) ?? null,
      description: description as string | undefined,
      issue: issue as string | undefined,
    });
    res.status(201).json((await result).rows[0]);
  } catch (error) {
    handleError(res, 'Failed to create task', error);
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  const body = req.body as Record<string, unknown>;
  const {
    title,
    taskType,
    priority,
    dueDatetime,
    status,
    description,
    issue,
    assignmentId,
    staffId,
  } = body;
  if (
    !id ||
    (title !== undefined && (typeof title !== 'string' || !title.trim())) ||
    (taskType !== undefined &&
      (typeof taskType !== 'string' || !taskTypes.includes(taskType as TaskType))) ||
    (priority !== undefined &&
      (typeof priority !== 'string' || !priorities.includes(priority as Priority))) ||
    (status !== undefined &&
      (typeof status !== 'string' || !statuses.includes(status as Status))) ||
    (description !== undefined && typeof description !== 'string') ||
    (issue !== undefined && typeof issue !== 'string') ||
    (assignmentId !== undefined && (typeof assignmentId !== 'string' || !isUuid(assignmentId))) ||
    (staffId !== undefined && (typeof staffId !== 'string' || !isUuid(staffId))) ||
    !validDate(dueDatetime)
  )
    return badRequest(res, 'title, priority, status, and dueDatetime must be valid');
  try {
    const result = await service.updateTask(id, {
      title: title as string | undefined,
      taskType: taskType as TaskType | undefined,
      priority: priority as Priority | undefined,
      dueDatetime: dueDatetime as string | null | undefined,
      status: status as Status | undefined,
      description: description as string | undefined,
      issue: issue as string | undefined,
      assignmentId: assignmentId as string | undefined,
      staffId: staffId as string | undefined,
    });
    res.json((await result).rows[0]);
  } catch (error) {
    handleError(res, 'Failed to update task', error);
  }
}

export async function completeTask(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  try {
    res.json((await service.completeTask(id)).rows[0]);
  } catch (error) {
    handleError(res, 'Failed to complete task', error);
  }
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  try {
    await service.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    handleError(res, 'Failed to delete task', error);
  }
}

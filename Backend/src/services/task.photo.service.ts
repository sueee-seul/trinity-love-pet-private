import * as repository from '../repositories/task.repository.js';
import { removeTaskPhoto, saveTaskPhoto } from './task.photo.storage.js';
import { TaskServiceError } from './task.service.base.js';
import { publishTaskEvent } from './livecare.events.js';

// How many photos and videos together a single task is allowed to carry.
export const MAX_TASK_PHOTOS = 3;

/** One upload that passed the boundary check, with the extension its bytes decided. */
export interface TaskMediaUpload {
  file: Express.Multer.File;
  extension: string;
}

export const addTaskPhotos = async (
  taskId: string,
  uploads: TaskMediaUpload[],
): Promise<{ storedNames: string[] }> => {
  const task = await repository.findTask(taskId);
  if (!task.rows[0]) throw new TaskServiceError('Task not found', 404);

  const existing = Number((await repository.countTaskPhotos(taskId)).rows[0]?.count ?? 0);
  if (existing + uploads.length > MAX_TASK_PHOTOS) {
    const remaining = Math.max(0, MAX_TASK_PHOTOS - existing);
    throw new TaskServiceError(
      `A task can have at most ${MAX_TASK_PHOTOS} photos or videos. ${
        remaining === 0 ? 'Delete one first.' : `You can add ${remaining} more.`
      }`,
    );
  }

  const storedNames: string[] = [];
  for (const upload of uploads) {
    const { storedName, displayName } = await saveTaskPhoto(upload.file, upload.extension);
    const inserted = await repository.insertTaskPhoto(taskId, storedName, displayName);
    if (!inserted.rows[0]) {
      await removeTaskPhoto(storedName);
      throw new TaskServiceError('Task not found', 404);
    }
    storedNames.push(storedName);
  }
  publishTaskEvent(task.rows[0].pet_uuid);
  return { storedNames };
};

export const getTaskPhoto = async (
  taskId: string,
  storedName: string,
): Promise<{ storedName: string; displayName: string } | null> => {
  const row = (await repository.findTaskPhoto(taskId, storedName)).rows[0] as
    { photo_url: string; caption: string | null } | undefined;
  if (!row) return null;
  return { storedName: row.photo_url, displayName: row.caption || row.photo_url };
};

export const deleteTaskPhoto = async (taskId: string, storedName: string): Promise<void> => {
  const task = await repository.findTask(taskId);
  const removed = (await repository.deleteTaskPhotoByName(taskId, storedName)).rows[0] as
    { photo_url: string } | undefined;
  if (!removed) throw new TaskServiceError('No photo for this task', 404);
  await removeTaskPhoto(removed.photo_url);
  if (task.rows[0]) publishTaskEvent(task.rows[0].pet_uuid);
};

export const isTaskOwnedByPetParent = async (
  taskId: string,
  petOwnersUuid: string,
): Promise<boolean> => {
  const row = (await repository.findTaskPetOwner(taskId)).rows[0] as
    { pet_owners_uuid: string } | undefined;
  return row?.pet_owners_uuid === petOwnersUuid;
};

import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

// A task can carry many photos over time (media_logs composite PK on
// tasks_uuid + created_at); photo_url is the on-disk name, caption the original.
// clock_timestamp() (not NOW(), which is fixed for the whole transaction) keeps
// the created_at PK distinct when several photos are inserted back to back.
export const insertTaskPhoto = (
  taskId: string,
  storedName: string,
  displayName: string,
): Promise<QueryResult> =>
  pool.query(
    `INSERT INTO media_logs (tasks_uuid, photo_url, caption, created_at)
     SELECT $1::uuid, $2, $3, clock_timestamp()
     WHERE EXISTS (SELECT 1 FROM tasks WHERE uuid = $1::uuid)
     RETURNING photo_url`,
    [taskId, storedName, displayName],
  );

export const countTaskPhotos = (taskId: string): Promise<QueryResult> =>
  pool.query('SELECT count(*)::int AS count FROM media_logs WHERE tasks_uuid = $1::uuid', [taskId]);

export const findTaskPhoto = (taskId: string, storedName: string): Promise<QueryResult> =>
  pool.query(
    `SELECT photo_url, caption FROM media_logs
     WHERE tasks_uuid = $1::uuid AND photo_url = $2
     LIMIT 1`,
    [taskId, storedName],
  );

export const deleteTaskPhotoByName = (taskId: string, storedName: string): Promise<QueryResult> =>
  pool.query(
    `DELETE FROM media_logs
     WHERE tasks_uuid = $1::uuid AND photo_url = $2
     RETURNING photo_url`,
    [taskId, storedName],
  );

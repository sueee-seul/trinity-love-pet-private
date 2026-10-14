import { newZealandDateOf } from '../common/utils/new-zealand-time.js';
import { pool } from '../config/database.js';

export interface StayPhoto {
  taskId: string;
  taskTitle: string;
  storedName: string;
  takenAt: Date;
  /** The New Zealand day the photo was taken, YYYY-MM-DD. */
  day: string;
}

interface StayPhotoRow {
  task_id: string;
  title: string;
  photo_url: string;
  created_at: Date;
}

/**
 * The care photos of one stay, newest first: photos staff attached to the pet's own care tasks
 * ('pet' tasks only, never an internal staff task such as an incident write-up) between drop-off
 * and pick-up.
 */
export const listStayPhotos = async (
  petUuid: string,
  dropOffAt: Date,
  pickUpAt: Date,
): Promise<StayPhoto[]> => {
  const result = await pool.query<StayPhotoRow>(
    `SELECT t.uuid::text AS task_id, t.title, m.photo_url, m.created_at
       FROM media_logs m
       JOIN tasks t ON t.uuid = m.tasks_uuid
      WHERE t.pet_uuid = $1::uuid
        AND t.task_type = 'pet'
        AND m.created_at BETWEEN $2::timestamptz AND $3::timestamptz
      ORDER BY m.created_at DESC`,
    [petUuid, dropOffAt, pickUpAt],
  );
  return result.rows.map((row) => ({
    taskId: row.task_id,
    taskTitle: row.title,
    storedName: row.photo_url,
    takenAt: row.created_at,
    day: newZealandDateOf(row.created_at),
  }));
};

/**
 * One photo per day of the stay, the newest of each day, newest day first, at most `limit`: what
 * a report carries so a long stay is shown across its days rather than its last afternoon. Pure.
 */
export const onePhotoPerDay = (photos: StayPhoto[], limit: number): StayPhoto[] => {
  const seen = new Set<string>();
  const picked: StayPhoto[] = [];
  for (const photo of photos) {
    if (seen.has(photo.day)) continue;
    seen.add(photo.day);
    picked.push(photo);
    if (picked.length === limit) break;
  }
  return picked;
};

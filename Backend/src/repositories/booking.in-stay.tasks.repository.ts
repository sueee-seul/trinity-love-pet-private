import type { PoolClient } from 'pg';

/**
 * Care tasks touched by a change made while the pet is staying. Generated tasks hold the Auckland
 * day as midnight in the UTC slot (see task.fromBooking.repository.ts), so days are compared as
 * `(scheduled_at AT TIME ZONE 'UTC')::date`.
 */

export interface AddOnTask {
  bookingPetsUuid: string;
  title: string;
  /** The Auckland day, YYYY-MM-DD; the manager sets the hour when fitting it to a shift. */
  day: string;
  description: string;
  priority: 'mid' | 'high';
}

/** One task for a booked add-on; null when the pet no longer exists. */
export const insertAddOnTask = async (
  client: PoolClient,
  task: AddOnTask,
): Promise<string | null> => {
  const result = await client.query<{ uuid: string }>(
    `INSERT INTO tasks (pet_uuid, title, task_type, priority, scheduled_at, description, status)
     SELECT bp.pet_uuid, $2::varchar, 'pet', $3, $4::timestamptz, $5, 'pending'
       FROM booking_pets bp
      WHERE bp.uuid = $1::uuid
     RETURNING uuid::text AS uuid`,
    [task.bookingPetsUuid, task.title, task.priority, `${task.day}T00:00:00Z`, task.description],
  );
  return result.rows[0]?.uuid ?? null;
};

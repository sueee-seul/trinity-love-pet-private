import { pool } from '../config/database.js';
import type { SqlRunner } from './booking.capacity.repository.js';

/**
 * The dose record of a stay (`medication_administrations`, see
 * 20261007_medication_administrations.sql) and the care tasks that carry each dose. What happened
 * to a dose is never stored twice: it is read from the task staff tick.
 */

/** The shared pool, or a client inside a transaction: both run SQL the same way. */
type Runner = SqlRunner;

export interface AdministrationRow {
  id: string;
  bookingPetsUuid: string;
  medicationId: string;
  medicineName: string;
  dose: number;
  unit: string;
  slot: string;
  scheduledFor: Date;
  taskStatus: string | null;
  completedAt: Date | null;
  staffName: string | null;
  issue: string | null;
  alertedAt: Date | null;
}

interface AdministrationSqlRow {
  id: string;
  booking_pets_uuid: string;
  medication_id: string;
  medicine_name: string;
  dose: string;
  unit: string;
  slot: string;
  scheduled_for: Date;
  task_status: string | null;
  completed_at: Date | null;
  staff_name: string | null;
  issue: string | null;
  alerted_at: Date | null;
}

const ADMINISTRATION_SELECT = `
  SELECT a.uuid::text AS id, a.booking_pets_uuid::text AS booking_pets_uuid,
         a.pet_medications_uuid::text AS medication_id, m.name AS medicine_name,
         a.dose::text AS dose, a.unit, a.slot, a.scheduled_for,
         t.status AS task_status, t.completed_at,
         COALESCE(u.display_name, u.username) AS staff_name, t.issue, a.alerted_at
    FROM medication_administrations a
    JOIN pet_medications m ON m.uuid = a.pet_medications_uuid
    LEFT JOIN tasks t ON t.uuid = a.tasks_uuid
    LEFT JOIN users u ON u.uuid = t.employees_uuid`;

const toRow = (row: AdministrationSqlRow): AdministrationRow => ({
  id: row.id,
  bookingPetsUuid: row.booking_pets_uuid,
  medicationId: row.medication_id,
  medicineName: row.medicine_name,
  dose: Number(row.dose),
  unit: row.unit,
  slot: row.slot,
  scheduledFor: row.scheduled_for,
  taskStatus: row.task_status,
  completedAt: row.completed_at,
  staffName: row.staff_name,
  issue: row.issue,
  alertedAt: row.alerted_at,
});

/** Every dose of one stay on one Auckland day, in due order. */
export const listAdministrationsForDay = async (
  bookingPetsUuid: string,
  day: string,
  runner: Runner = pool,
): Promise<AdministrationRow[]> => {
  const result = await runner.query<AdministrationSqlRow>(
    `${ADMINISTRATION_SELECT}
      WHERE a.booking_pets_uuid = $1::uuid
        AND (a.scheduled_for AT TIME ZONE 'Pacific/Auckland')::date = $2::date
      ORDER BY a.scheduled_for, m.name`,
    [bookingPetsUuid, day],
  );
  return result.rows.map(toRow);
};

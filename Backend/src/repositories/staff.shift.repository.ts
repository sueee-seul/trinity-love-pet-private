import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';
import {
  parseEntries,
  serialiseEntries,
  type ShiftEntry,
  type ShiftNoteRow,
} from './staff.shift.serde.js';

// The manager's Staff Shift Table lives as a JSON array in the unused
// employees.shift_details TEXT column (one array per staff member); findFreeStaff
// reads the same JSON. See staff.shift.serde for the (de)serialisation.

interface StaffShiftDetailsRow {
  staff_id: string;
  staff_name: string;
  shift_details: string | null;
}

const staffRows = async (): Promise<StaffShiftDetailsRow[]> => {
  const result = await pool.query<StaffShiftDetailsRow>(
    `SELECT u.uuid::text AS staff_id,
            COALESCE(u.display_name, u.username) AS staff_name,
            e.shift_details
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     WHERE u.is_employee = TRUE AND e.staff_role = 'staff'
     ORDER BY staff_name`,
  );
  return result.rows;
};

const findHolder = (
  rows: StaffShiftDetailsRow[],
  entryId: string,
): StaffShiftDetailsRow | undefined =>
  rows.find((row) => parseEntries(row.shift_details).some((entry) => entry.id === entryId));

const writeEntries = (staffId: string, entries: ShiftEntry[]): Promise<QueryResult> =>
  pool.query(`UPDATE employees SET shift_details = $2 WHERE users_uuid = $1::uuid`, [
    staffId,
    serialiseEntries(entries),
  ]);

export const findStaffOptions = (): Promise<QueryResult> =>
  pool.query(
    `SELECT u.uuid::text AS id, COALESCE(u.display_name, u.username) AS name, e.staff_status
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     WHERE u.is_employee = TRUE AND e.staff_role = 'staff'
     ORDER BY name`,
  );

export interface ListShiftNotesFilter {
  staffId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export const listShiftNotes = async (
  filter: ListShiftNotesFilter = {},
): Promise<ShiftNoteRow[]> => {
  const rows = await staffRows();
  const scopedRows = filter.staffId ? rows.filter((row) => row.staff_id === filter.staffId) : rows;
  const notes = scopedRows.flatMap((row) =>
    parseEntries(row.shift_details)
      .filter(
        (entry) =>
          (!filter.from || entry.date >= filter.from) && (!filter.to || entry.date <= filter.to),
      )
      .map((entry) => ({
        id: entry.id,
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        date: entry.date,
        start_time: entry.start,
        finish_time: entry.finish,
        issue: entry.issue,
      })),
  );
  return notes.sort(
    (a, b) => b.date.localeCompare(a.date) || a.staff_name.localeCompare(b.staff_name),
  );
};

export const insertShiftNote = async (
  staffId: string,
  date: string,
  startTime: string | null,
  finishTime: string | null,
  issue: string | null,
): Promise<string> => {
  const target = (await staffRows()).find((row) => row.staff_id === staffId);
  if (!target) throw new Error('STAFF_NOT_FOUND');
  const id = randomUUID();
  await writeEntries(staffId, [
    ...parseEntries(target.shift_details),
    { id, date, start: startTime, finish: finishTime, issue },
  ]);
  return id;
};

export const updateShiftNote = async (
  id: string,
  staffId: string,
  date: string,
  startTime: string | null,
  finishTime: string | null,
  issue: string | null,
): Promise<boolean> => {
  const rows = await staffRows();
  const holder = findHolder(rows, id);
  if (!holder) return false;
  const target = rows.find((row) => row.staff_id === staffId);
  if (!target) throw new Error('STAFF_NOT_FOUND');
  const nextEntry: ShiftEntry = { id, date, start: startTime, finish: finishTime, issue };
  const holderWithout = parseEntries(holder.shift_details).filter((entry) => entry.id !== id);

  if (holder.staff_id === target.staff_id) {
    await writeEntries(staffId, [...holderWithout, nextEntry]);
  } else {
    await writeEntries(holder.staff_id, holderWithout);
    await writeEntries(staffId, [...parseEntries(target.shift_details), nextEntry]);
  }
  return true;
};

export const deleteShiftNote = async (id: string): Promise<boolean> => {
  const holder = findHolder(await staffRows(), id);
  if (!holder) return false;
  await writeEntries(
    holder.staff_id,
    parseEntries(holder.shift_details).filter((entry) => entry.id !== id),
  );
  return true;
};

import type { PoolClient } from 'pg';
import * as repository from '../repositories/task.repository.js';
import { TaskServiceError } from './task.service.base.js';
import { buildTaskSpecs, type BookingTaskInputRow } from './task.fromBooking.mapping.js';
import { publishTaskEvent } from './livecare.events.js';

export type BookingTaskGenerationResult = {
  bookingId: string;
  bookingStatus: string;
  generated: number;
  skipped: number;
  tasks: { id: string; petId: string; title: string }[];
};

export const createTasksFromBooking = async (
  bookingId: string,
): Promise<BookingTaskGenerationResult> => {
  const booking = (await repository.findBookingSummary(bookingId)).rows[0] as
    { status: string } | undefined;
  if (!booking) throw new TaskServiceError('Booking not found', 404);

  const rows = (await repository.findBookingTaskInputs(bookingId)).rows as BookingTaskInputRow[];
  const specs = rows.flatMap(buildTaskSpecs);

  const tasks: { id: string; petId: string; title: string }[] = [];
  for (const spec of specs) {
    const inserted = (
      await repository.insertGeneratedTask(
        spec.petId,
        spec.title,
        spec.scheduledAt,
        spec.description,
        spec.issue,
        spec.priority,
      )
    ).rows[0] as { uuid: string } | undefined;
    if (inserted) tasks.push({ id: inserted.uuid, petId: spec.petId, title: spec.title });
  }

  for (const petId of new Set(tasks.map((task) => task.petId))) {
    publishTaskEvent(petId);
  }

  return {
    bookingId,
    bookingStatus: booking.status,
    generated: tasks.length,
    skipped: specs.length - tasks.length,
    tasks,
  };
};

export type BookingPetTaskGenerationResult = {
  bookingPetsUuid: string;
  generated: number;
  skipped: number;
  tasks: { id: string; petId: string; title: string }[];
};

// Mirrors BookingTaskGenerationResult but keyed by bookingPetsUuid instead of
// bookingId, since this result describes one pet's generated tasks, not
// every pet on the booking.
export const createTasksForBookingPet = async (
  bookingPetsUuid: string,
): Promise<BookingPetTaskGenerationResult> => {
  const rows = (await repository.findBookingPetTaskInput(bookingPetsUuid))
    .rows as BookingTaskInputRow[];
  if (rows.length === 0) throw new TaskServiceError('Booking pet not found', 404);

  const specs = rows.flatMap(buildTaskSpecs);

  const tasks: { id: string; petId: string; title: string }[] = [];
  for (const spec of specs) {
    const inserted = (
      await repository.insertGeneratedTask(
        spec.petId,
        spec.title,
        spec.scheduledAt,
        spec.description,
        spec.issue,
        spec.priority,
      )
    ).rows[0] as { uuid: string } | undefined;
    if (inserted) tasks.push({ id: inserted.uuid, petId: spec.petId, title: spec.title });
  }

  for (const petId of new Set(tasks.map((task) => task.petId))) {
    publishTaskEvent(petId);
  }

  return {
    bookingPetsUuid,
    generated: tasks.length,
    skipped: specs.length - tasks.length,
    tasks,
  };
};

/** Deletes the care plan in the stay's current window; pass the transaction's client to share it. */
export const deleteTasksForBookingPet = async (
  bookingPetsUuid: string,
  client?: PoolClient,
): Promise<void> => {
  const deleted = await repository.deleteTasksForBookingPet(bookingPetsUuid, client);
  // Inside a transaction nobody can see the delete until it commits, so only a delete on its own
  // tells open Live care pages to refresh; the caller's new care plan tells them after the commit.
  if (client) return;
  const petIds = (deleted.rows as { pet_id: string }[]).map((row) => row.pet_id);
  for (const petId of new Set(petIds)) publishTaskEvent(petId);
};

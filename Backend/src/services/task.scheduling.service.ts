import * as repository from '../repositories/task.repository.js';
import { TaskServiceError } from './task.service.base.js';

export const assertSlotAvailable = async (
  assignmentId: string,
  petId: string,
  dueDatetime: string | null,
  excludeTaskId: string | null,
): Promise<void> => {
  const assignment = await repository.findAssignmentSlot(
    assignmentId,
    petId,
    dueDatetime,
    excludeTaskId,
  );
  if (!assignment.rows[0])
    throw new TaskServiceError(
      'This staff member is outside their shift or already has a task at this time.',
    );
  if (dueDatetime) {
    const conflict = await repository.findPetTimeConflict(petId, dueDatetime, excludeTaskId);
    if (conflict.rows[0])
      throw new TaskServiceError(
        'This pet already has another task scheduled at this exact time with a different staff member.',
      );
  }
};

export const assertStaffFree = async (
  staffId: string,
  dueDatetime: string | null,
  excludeTaskId: string | null,
): Promise<void> => {
  if (!dueDatetime) return;
  const conflict = await repository.findStaffTimeConflict(staffId, dueDatetime, excludeTaskId);
  if (conflict.rows[0])
    throw new TaskServiceError(
      'This staff member already has a task within 30 minutes of this time.',
    );
};

export const assertStaffOnShift = async (
  staffId: string | null | undefined,
  dueDatetime: string | null,
): Promise<void> => {
  // No time or no assignee -> nothing to check (mirrors assertStaffFree).
  if (!dueDatetime || !staffId) return;
  const shift = await repository.findStaffShiftInRoster(dueDatetime, staffId);
  if (!shift.rows[0]) throw new TaskServiceError('This staff member is not on shift at this time.');
};

const formatStayDate = (value: Date): string =>
  value.toLocaleDateString('en-GB', { timeZone: 'Pacific/Auckland' });

export const assertWithinStay = async (
  petId: string,
  dueDatetime: string | null,
): Promise<void> => {
  if (!dueDatetime) return;
  const stay = await repository.findPetStayForDate(petId, dueDatetime);
  const row = stay.rows[0];
  if (!row || row.within_stay !== false) return;
  throw new TaskServiceError(
    `This date is outside the pet's stay period (${formatStayDate(
      new Date(row.drop_off_time),
    )} to ${formatStayDate(new Date(row.pick_up_time))}). Pick a date within the check-in and check-out dates.`,
  );
};

export const assertNotInPast = async (dueDatetime: string | null): Promise<void> => {
  if (!dueDatetime) return;
  const result = await repository.findIsPastDueDatetime(dueDatetime);
  if (result.rows[0]?.is_past) {
    throw new TaskServiceError('This time has already passed. Pick a time in the future.');
  }
};

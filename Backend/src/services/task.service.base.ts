import * as repository from '../repositories/task.repository.js';
import type { Priority, Status, TaskType } from '../modules/tasks/task.types.js';

export type TaskInput = {
  assignmentId?: string | undefined;
  staffId?: string | undefined;
  templateId: string | undefined;
  title: string;
  taskType: TaskType;
  priority: Priority;
  dueDatetime: string | null;
  description: string | undefined;
  issue: string | undefined;
};

export type TaskUpdate = {
  assignmentId?: string | undefined;
  staffId?: string | undefined;
  templateId?: string | undefined;
  title?: string | undefined;
  taskType?: TaskType | undefined;
  priority?: Priority | undefined;
  dueDatetime?: string | null | undefined;
  status?: Status | undefined;
  description?: string | undefined;
  issue?: string | undefined;
};

export class TaskServiceError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const getAvailableAssignments = async (
  petId: string,
  dueDatetime: string | null,
  excludeTaskId: string | null,
): Promise<Awaited<ReturnType<typeof repository.findAvailableAssignments>>> =>
  repository.findAvailableAssignments(petId, dueDatetime, excludeTaskId);

// bookingPetsUuid, when given, scopes to one specific stay instead of the
// calendar-relative range. It takes priority over `range` since a caller asking
// for one booking's tasks doesn't care what "today" or "this week" means.
export const getPetTasks = (
  petId: string,
  range: repository.PetTaskRange = 'all',
  bookingPetsUuid?: string,
):
  | ReturnType<typeof repository.findPetTasks>
  | ReturnType<typeof repository.findTasksForBookingPet> =>
  bookingPetsUuid
    ? repository.findTasksForBookingPet(bookingPetsUuid)
    : repository.findPetTasks(petId, range);

export const getStaffTasks = (
  staffId: string,
  range: repository.StaffTaskRange = 'today',
): ReturnType<typeof repository.findStaffTasks> => repository.findStaffTasks(staffId, range);

export const getTask = (taskId: string): ReturnType<typeof repository.findTask> =>
  repository.findTask(taskId);
export const getTaskTemplates = (): ReturnType<typeof repository.findTemplates> =>
  repository.findTemplates();
export const getTaskStaff = (): ReturnType<typeof repository.findTaskStaff> =>
  repository.findTaskStaff();
export const getFreeStaff = async (
  dueDatetime: string,
  excludeTaskId: string | null,
  petId: string | null = null,
): Promise<Awaited<ReturnType<typeof repository.findFreeStaff>>> => {
  // A date outside the pet's check-in / check-out window has no assignable
  // staff: the pet is not in the facility then.
  if (petId) {
    const stay = await repository.findPetStayForDate(petId, dueDatetime);
    if (stay.rows[0]?.within_stay === false) {
      return { ...stay, rows: [], rowCount: 0 };
    }
  }
  return repository.findFreeStaff(dueDatetime, excludeTaskId);
};

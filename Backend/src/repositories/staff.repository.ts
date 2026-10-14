/**
 * Compatibility exports for the Staff repository. Each implementation now
 * owns one persistence responsibility: reads, assignments, or writes.
 */

export {
  findStaffByEmail,
  findStaffById,
  findManagerRecipient,
  listFacilities,
  listStaff,
  listStaffOptions,
} from './staff.read.repository.js';
export { listAssignedPets } from './staff.assignment.repository.js';
export { createStaff, removeStaff, updateStaff } from './staff.write.repository.js';

export type { AssignedPetRow, ListAssignedPetsResult } from './staff.assignment.repository.js';
export type {
  StaffCreateResult,
  StaffRemovalResult,
  StaffUpdateResult,
  StaffWriteInput,
} from './staff.write.repository.js';

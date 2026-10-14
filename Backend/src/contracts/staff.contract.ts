export const STAFF_ROLES = ['manager', 'staff'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ['active', 'on-leave'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['full-time', 'part-time'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface StaffMember {
  id: string;
  name: string;
  /** `users.username` - the handle this person signs in with. */
  username: string;
  email: string;
  phone: string | null;
  employee_role: StaffRole;
  status: StaffStatus;
  employeeNumber: string;
  joinedDate: string;
  avatarUrl: string | null;
  facilityUuid: string;
  facilityName: string;
  employmentType: EmploymentType;
  /** `employees.title` - the job title, e.g. "Grooming Specialist". */
  title: string | null;
  /** `employees.shift_details`, e.g. "Tuesday to Saturday, 08:00 to 16:00". */
  shiftDetails: string | null;
}

/** Editable by the account holder themselves. Role is deliberately absent. */
export type StaffSelfEditableFields = Pick<StaffMember, 'name' | 'phone' | 'avatarUrl'>;

/** Editable by a manager, on top of the self-editable fields. */
export type StaffManagedFields = Pick<
  StaffMember,
  | 'email'
  | 'employee_role'
  | 'status'
  | 'facilityUuid'
  | 'employmentType'
  | 'title'
  | 'shiftDetails'
>;

export type StaffCreateInput = Pick<
  StaffMember,
  'name' | 'email' | 'employee_role' | 'status' | 'facilityUuid' | 'employmentType'
>;

export interface FacilityOption {
  id: string;
  name: string;
}

export interface StaffManagementOptions {
  facilities: FacilityOption[];
  employmentTypes: EmploymentType[];
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface ManagerRecipient {
  id: string;
  name: string;
  email: string;
}

export interface StaffCreateResult {
  staff: StaffMember;
  temporaryPassword: string;
}

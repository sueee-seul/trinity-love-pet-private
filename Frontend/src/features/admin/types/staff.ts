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

/**
 * Pets a carer is responsible for. This is what the data can currently
 * evidence. The shift roster in `staff_assignments` keys on a different id
 * system and is not wired up, so this is not presented as a full task list.
 */
export interface AssignedPet {
  petId: string;
  petName: string;
  petType: string;
  ownerName: string;
  checkInDate: string;
  checkOutDate: string | null;
}

/** What a person may change about their own account. Employee role is not included. */
export type StaffSelfEdit = Pick<StaffMember, 'name' | 'phone' | 'avatarUrl'> & {
  /** A new file is uploaded before the JSON profile update is sent. */
  avatarFile?: File | null;
};

/** What a manager may change about someone else's account. */
export type StaffManagedEdit = Pick<
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

export interface StaffCreateResult {
  staff: StaffMember;
  temporaryPassword: string;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  manager: 'Manager',
  staff: 'Staff',
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: 'Active',
  'on-leave': 'On leave',
};

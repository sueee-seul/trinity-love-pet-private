import { randomInt } from 'node:crypto';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as staffRepository from '../repositories/staff.repository.js';
import {
  EMPLOYMENT_TYPES,
  STAFF_ROLES,
  STAFF_STATUSES,
  type StaffCreateInput,
  type StaffCreateResult,
  type StaffManagedFields,
  type StaffMember,
  type StaffManagementOptions,
  type ManagerRecipient,
  type StaffOption,
  type EmploymentType,
  type StaffRole,
  type StaffSelfEditableFields,
  type StaffStatus,
} from '../contracts/staff.contract.js';
import { PHONE_FORMAT_MESSAGE, isValidPhoneNumber } from '../common/utils/phone.js';
import { validateProfileMediaUrl } from './profile.media.storage.js';

/** A carer's workload as projected by the Staff assignment endpoint. */
export interface AssignedPet {
  petId: string;
  petName: string;
  petType: string;
  ownerName: string;
  checkInDate: string;
  checkOutDate: string | null;
}

const isEmploymentType = (value: unknown): value is EmploymentType => {
  return typeof value === 'string' && EMPLOYMENT_TYPES.some((type) => type === value);
};

const isStaffRole = (value: unknown): value is StaffRole => {
  return typeof value === 'string' && STAFF_ROLES.some((role) => role === value);
};

const isStaffStatus = (value: unknown): value is StaffStatus => {
  return typeof value === 'string' && STAFF_STATUSES.some((status) => status === value);
};

const TEMPORARY_PASSWORD_LENGTH = 20;
const TEMPORARY_PASSWORD_CHARACTERS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';

const generateTemporaryPassword = (): string => {
  const requiredCharacters = ['A', 'a', '2', '!'];
  const remainingCharacters = Array.from(
    { length: TEMPORARY_PASSWORD_LENGTH - 4 },
    () => TEMPORARY_PASSWORD_CHARACTERS[randomInt(TEMPORARY_PASSWORD_CHARACTERS.length)],
  );
  const characters = [...requiredCharacters, ...remainingCharacters];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = characters[index];
    characters[index] = characters[swapIndex] ?? current;
    characters[swapIndex] = current;
  }

  return characters.join('');
};

const requireNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${field} is required`, 'VALIDATION_ERROR', 400);
  }
  return value.trim();
};

const requireEmail = (value: unknown): string => {
  const email = requireNonEmptyString(value, 'Email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('Email must be a valid address', 'VALIDATION_ERROR', 400);
  }
  return email.toLowerCase();
};

/**
 * A contact number is how the facility reaches this person, so it is required
 * rather than optional, and it has to be a number that can actually be dialled.
 */
const requirePhoneNumber = (value: unknown): string => {
  const phone = requireNonEmptyString(value, 'Contact number');
  if (!isValidPhoneNumber(phone)) {
    throw new AppError(PHONE_FORMAT_MESSAGE, 'VALIDATION_ERROR', 400);
  }
  return phone;
};

const optionalString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be text`, 'VALIDATION_ERROR', 400);
  }
  return value.trim() || null;
};

/* ------------------------------------------------------------------ reads */

export const getList = async (): Promise<StaffMember[]> => {
  return staffRepository.listStaff();
};

export const getManagementOptions = async (): Promise<StaffManagementOptions> => {
  const facilities = await staffRepository.listFacilities();
  return {
    facilities,
    employmentTypes: [...EMPLOYMENT_TYPES],
  };
};

export const getDetail = async (id: string): Promise<StaffMember> => {
  const stored = await staffRepository.findStaffById(id);
  if (!stored) {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  return stored;
};

export const getByEmail = async (email: string): Promise<StaffMember> => {
  const stored = await staffRepository.findStaffByEmail(email);
  if (stored) {
    return stored;
  }
  throw new AppError('No staff account matches that email', 'NOT_FOUND', 404);
};

export const getOptions = async (): Promise<StaffOption[]> => {
  return staffRepository.listStaffOptions();
};

export const getManagerRecipient = async (): Promise<ManagerRecipient> => {
  const manager = await staffRepository.findManagerRecipient();
  if (!manager) {
    throw new AppError(
      'Manager recipient is not configured',
      'MANAGER_RECIPIENT_NOT_CONFIGURED',
      500,
    );
  }
  return manager;
};

export const getAssignedPets = async (id: string): Promise<AssignedPet[]> => {
  const assignmentResult = await staffRepository.listAssignedPets(id);
  if (assignmentResult.outcome === 'not_found') {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  return assignmentResult.assignments;
};

/* ----------------------------------------------------------------- writes */

export const create = async (input: unknown): Promise<StaffCreateResult> => {
  if (typeof input !== 'object' || input === null) {
    throw new AppError('Staff details are required', 'VALIDATION_ERROR', 400);
  }
  const body = input as Partial<StaffCreateInput>;

  const name = requireNonEmptyString(body.name, 'Name');
  const email = requireEmail(body.email);
  const facilityUuid = requireNonEmptyString(body.facilityUuid, 'Facility');
  if (!isEmploymentType(body.employmentType)) {
    throw new AppError('Employment type must be full-time or part-time', 'VALIDATION_ERROR', 400);
  }

  const employeeRole = isStaffRole(body.employee_role) ? body.employee_role : 'staff';
  const status = isStaffStatus(body.status) ? body.status : 'active';
  const temporaryPassword = generateTemporaryPassword();

  const result = await staffRepository.createStaff({
    name,
    email,
    facilityUuid,
    employmentType: body.employmentType,
    employee_role: employeeRole,
    status,
    temporaryPassword,
  });
  if (result.outcome === 'created') {
    return { staff: result.staff, temporaryPassword };
  }
  if (result.outcome === 'email_conflict') {
    throw new AppError('That email is already used by another staff member', 'CONFLICT', 409);
  }
  throw new AppError('Could not derive a unique username', 'CONFLICT', 409);
};

/**
 * Self-service edit. Role and status are not accepted here on purpose: letting
 * someone raise their own role would make every permission check meaningless.
 */
export const updateOwnProfile = async (id: string, input: unknown): Promise<StaffMember> => {
  if (typeof input !== 'object' || input === null) {
    throw new AppError('Profile details are required', 'VALIDATION_ERROR', 400);
  }
  const body = input as Partial<StaffSelfEditableFields>;
  let avatarUrl: string | null | undefined;
  if (body.avatarUrl !== undefined) {
    try {
      avatarUrl = await validateProfileMediaUrl(body.avatarUrl, 'avatar', id);
    } catch (error: unknown) {
      throw new AppError(
        error instanceof Error ? error.message : 'Profile image reference is invalid',
        'VALIDATION_ERROR',
        400,
      );
    }
  }

  const result = await staffRepository.updateStaff(id, {
    ...(body.name !== undefined ? { name: requireNonEmptyString(body.name, 'Name') } : {}),
    ...(body.phone !== undefined ? { phone: requirePhoneNumber(body.phone) } : {}),
    ...(body.avatarUrl !== undefined ? { avatarUrl: avatarUrl ?? null } : {}),
  });
  if (result.outcome === 'updated') {
    return result.staff;
  }
  if (result.outcome === 'not_found') {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  if (result.outcome === 'email_conflict') {
    throw new AppError('That email is already used by another staff member', 'CONFLICT', 409);
  }
  throw new AppError(
    'This is the only manager. Promote someone else before changing this role.',
    'CONFLICT',
    409,
  );
};

/**
 * Manager edit. Guards the one state the product cannot recover from: if the
 * last manager is demoted, nobody can promote anyone back and staff management
 * is permanently locked.
 */
export const updateAsManager = async (id: string, input: unknown): Promise<StaffMember> => {
  if (typeof input !== 'object' || input === null) {
    throw new AppError('Staff details are required', 'VALIDATION_ERROR', 400);
  }
  const body = input as Partial<StaffManagedFields>;

  if (body.employee_role !== undefined && !isStaffRole(body.employee_role)) {
    throw new AppError('Role must be manager or staff', 'VALIDATION_ERROR', 400);
  }
  if (body.status !== undefined && !isStaffStatus(body.status)) {
    throw new AppError('Status must be active or on-leave', 'VALIDATION_ERROR', 400);
  }
  if (body.facilityUuid !== undefined) {
    requireNonEmptyString(body.facilityUuid, 'Facility');
  }
  if (body.employmentType !== undefined && !isEmploymentType(body.employmentType)) {
    throw new AppError('Employment type must be full-time or part-time', 'VALIDATION_ERROR', 400);
  }

  const result = await staffRepository.updateStaff(id, {
    ...(body.email !== undefined ? { email: requireEmail(body.email) } : {}),
    ...(body.employee_role !== undefined && isStaffRole(body.employee_role)
      ? { employee_role: body.employee_role }
      : {}),
    ...(body.status !== undefined && isStaffStatus(body.status) ? { status: body.status } : {}),
    ...(body.facilityUuid !== undefined
      ? { facilityUuid: requireNonEmptyString(body.facilityUuid, 'Facility') }
      : {}),
    ...(body.employmentType !== undefined && isEmploymentType(body.employmentType)
      ? { employmentType: body.employmentType }
      : {}),
    // Both are nullable in `employees`, so an explicit blank clears them
    // rather than being rejected.
    ...(body.title !== undefined ? { title: optionalString(body.title, 'Job title') } : {}),
    ...(body.shiftDetails !== undefined
      ? { shiftDetails: optionalString(body.shiftDetails, 'Shift details') }
      : {}),
  });
  if (result.outcome === 'updated') {
    return result.staff;
  }
  if (result.outcome === 'not_found') {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  if (result.outcome === 'email_conflict') {
    throw new AppError('That email is already used by another staff member', 'CONFLICT', 409);
  }
  throw new AppError(
    'This is the only manager. Promote someone else before changing this role.',
    'CONFLICT',
    409,
  );
};

export const remove = async (id: string, actingStaffId: string | null): Promise<void> => {
  const result = await staffRepository.removeStaff(id, actingStaffId);
  if (result.outcome === 'removed') {
    return;
  }
  if (result.outcome === 'not_found') {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  if (result.outcome === 'self_removal') {
    throw new AppError('You cannot remove your own account', 'CONFLICT', 409);
  }
  if (result.outcome === 'last_manager') {
    throw new AppError(
      'This is the only manager. Promote someone else before removing this account.',
      'CONFLICT',
      409,
    );
  }
  throw new AppError(
    `${result.staffName} still has ${result.count} pet${result.count === 1 ? '' : 's'} assigned. Reassign them first.`,
    'CONFLICT',
    409,
  );
};

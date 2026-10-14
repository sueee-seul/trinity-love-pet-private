import { API_BASE_URL } from '../../../shared/api';
import { persistWithUploadedProfileMedia } from '../../../shared/api/profileMediaApi';
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  type AssignedPet,
  type StaffCreateResult,
  type StaffCreateInput,
  type StaffManagementOptions,
  type StaffManagedEdit,
  type StaffMember,
  type StaffSelfEdit,
} from '../types/staff';

const STAFF_BASE_URL = `${API_BASE_URL}/admin/staff`;

export class StaffApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StaffApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isStaffRole = (value: unknown): boolean => {
  return typeof value === 'string' && STAFF_ROLES.some((role) => role === value);
};

const isStaffStatus = (value: unknown): boolean => {
  return typeof value === 'string' && STAFF_STATUSES.some((status) => status === value);
};

const isEmploymentType = (value: unknown): boolean => {
  return value === 'full-time' || value === 'part-time';
};

const isStaffMember = (value: unknown): value is StaffMember => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.username === 'string' &&
    typeof value.email === 'string' &&
    (value.phone === null || typeof value.phone === 'string') &&
    isStaffRole(value.employee_role) &&
    isStaffStatus(value.status) &&
    typeof value.employeeNumber === 'string' &&
    typeof value.joinedDate === 'string' &&
    (value.avatarUrl === null || typeof value.avatarUrl === 'string') &&
    typeof value.facilityUuid === 'string' &&
    typeof value.facilityName === 'string' &&
    isEmploymentType(value.employmentType) &&
    (value.title === null || typeof value.title === 'string') &&
    (value.shiftDetails === null || typeof value.shiftDetails === 'string')
  );
};

const isStaffCreateResult = (value: unknown): value is StaffCreateResult => {
  return (
    isRecord(value) &&
    isStaffMember(value.staff) &&
    typeof value.temporaryPassword === 'string' &&
    value.temporaryPassword.length > 0
  );
};

const isStaffManagementOptions = (value: unknown): value is StaffManagementOptions => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.facilities) ||
    !Array.isArray(value.employmentTypes)
  ) {
    return false;
  }

  return (
    value.facilities.every(
      (facility) =>
        isRecord(facility) && typeof facility.id === 'string' && typeof facility.name === 'string',
    ) && value.employmentTypes.every(isEmploymentType)
  );
};

const isAssignedPet = (value: unknown): value is AssignedPet => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.petId === 'string' &&
    typeof value.petName === 'string' &&
    typeof value.petType === 'string' &&
    typeof value.ownerName === 'string' &&
    typeof value.checkInDate === 'string' &&
    (value.checkOutDate === null || typeof value.checkOutDate === 'string')
  );
};

/**
 * The API answers a rejected write with a readable sentence explaining the rule
 * that blocked it. Surfacing that text beats a generic failure message, so it is
 * lifted out of the payload here rather than discarded.
 */
const errorMessageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Body was empty or not JSON; the fallback is the best available message.
  }
  return fallback;
};

const parseStaffMember = async (response: Response): Promise<StaffMember> => {
  const payload: unknown = await response.json();
  if (!isStaffMember(payload)) {
    throw new Error('Invalid staff response');
  }
  return payload;
};

const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json' });

export const fetchStaffList = async (): Promise<StaffMember[]> => {
  const response = await fetch(STAFF_BASE_URL, { credentials: 'include' });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Staff list request failed'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isStaffMember)) {
    throw new Error('Invalid staff list response');
  }
  return payload;
};

export const fetchStaffByEmail = async (email: string): Promise<StaffMember> => {
  const response = await fetch(`${STAFF_BASE_URL}/me?email=${encodeURIComponent(email)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Staff lookup failed'),
      response.status,
    );
  }
  return parseStaffMember(response);
};

export const fetchStaffById = async (id: string): Promise<StaffMember> => {
  const response = await fetch(`${STAFF_BASE_URL}/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Staff lookup failed'),
      response.status,
    );
  }
  return parseStaffMember(response);
};

export const fetchStaffAssignments = async (id: string): Promise<AssignedPet[]> => {
  const response = await fetch(`${STAFF_BASE_URL}/${id}/assignments`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Assignment request failed'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isAssignedPet)) {
    throw new Error('Invalid assignment response');
  }
  return payload;
};

export const fetchStaffManagementOptions = async (): Promise<StaffManagementOptions> => {
  const response = await fetch(`${STAFF_BASE_URL}/options`, { credentials: 'include' });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Staff management options request failed'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isStaffManagementOptions(payload)) {
    throw new Error('Invalid staff management options response');
  }
  return payload;
};

export const createStaffMember = async (input: StaffCreateInput): Promise<StaffCreateResult> => {
  const response = await fetch(STAFF_BASE_URL, {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Could not add the staff member'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isStaffCreateResult(payload)) {
    throw new Error('Invalid staff creation response');
  }
  return payload;
};

export const updateStaffMember = async (
  id: string,
  input: Partial<StaffManagedEdit>,
): Promise<StaffMember> => {
  const response = await fetch(`${STAFF_BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Could not save the changes'),
      response.status,
    );
  }
  return parseStaffMember(response);
};

export const updateOwnStaffProfile = async (
  id: string,
  input: Partial<StaffSelfEdit>,
): Promise<StaffMember> => {
  return persistWithUploadedProfileMedia({
    target: 'avatar',
    file: input.avatarFile,
    persist: async (uploaded) => {
      const body = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.avatarUrl !== undefined || uploaded
          ? { avatarUrl: uploaded?.assetUrl ?? input.avatarUrl ?? null }
          : {}),
      };

      const response = await fetch(`${STAFF_BASE_URL}/${id}/self`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new StaffApiError(
          await errorMessageFrom(response, 'Could not save your profile'),
          response.status,
        );
      }
      return parseStaffMember(response);
    },
  });
};

export const deleteStaffMember = async (id: string): Promise<void> => {
  const response = await fetch(`${STAFF_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new StaffApiError(
      await errorMessageFrom(response, 'Could not remove the staff member'),
      response.status,
    );
  }
};

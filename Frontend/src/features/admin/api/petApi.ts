import { API_BASE_URL } from '../../../shared/api';
import {
  PET_GENDERS,
  PET_STATUSES,
  PET_TYPES,
  type Pet,
  type PetDetail,
  type PetGender,
  type PetMedication,
  type PetAssignment,
  type PetType,
} from '../types/pet';

export class PetApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PetApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isPetType = (value: unknown): boolean => {
  return typeof value === 'string' && PET_TYPES.some((type) => type === value);
};

const isPetGender = (value: unknown): boolean => {
  return typeof value === 'string' && PET_GENDERS.some((gender) => gender === value);
};

const isPetStatus = (value: unknown): boolean => {
  return typeof value === 'string' && PET_STATUSES.some((status) => status === value);
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizePet = (value: Record<string, unknown>): Pet => ({
  id: String(value.id),
  name: String(value.name),
  status: value.status as Pet['status'],
  checkInDate: String(value.checkInDate),
  checkOutDate: value.checkOutDate === null ? null : String(value.checkOutDate),
  type: value.type as Pet['type'],
  age: Number(value.age),
  gender: value.gender as Pet['gender'],
  ownerName: String(value.ownerName),
  breed: value.breed == null ? null : String(value.breed),
  weight: toFiniteNumber(value.weight),
  microchipNumber: value.microchipNumber == null ? null : String(value.microchipNumber),
});

const normalizeMedication = (value: Record<string, unknown>): PetMedication => ({
  id: String(value.id),
  name: String(value.name),
  strength: value.strength == null ? null : String(value.strength),
  dose: Number(value.dose),
  unit: String(value.unit),
  route: String(value.route),
  schedule: Array.isArray(value.schedule) ? value.schedule.map((entry) => String(entry)) : [],
  withFood: Boolean(value.withFood),
  instructions: value.instructions == null ? null : String(value.instructions),
  prescribedBy: value.prescribedBy == null ? null : String(value.prescribedBy),
  active: Boolean(value.active),
});

const normalizePetDetail = (value: Record<string, unknown>): PetDetail => ({
  ...normalizePet(value),
  healthNotes: value.healthNotes == null ? null : String(value.healthNotes),
  behaviourNotes: value.behaviourNotes == null ? null : String(value.behaviourNotes),
  medications: Array.isArray(value.medications)
    ? value.medications.map((medication) =>
        normalizeMedication(medication as Record<string, unknown>),
      )
    : [],
});

const isPet = (value: unknown): value is Pet => {
  if (!isRecord(value)) {
    return false;
  }

  const age = toFiniteNumber(value.age);
  const weight = toFiniteNumber(value.weight);

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isPetStatus(value.status) &&
    typeof value.checkInDate === 'string' &&
    (value.checkOutDate === null || typeof value.checkOutDate === 'string') &&
    isPetType(value.type) &&
    age !== null &&
    isPetGender(value.gender) &&
    typeof value.ownerName === 'string' &&
    (value.breed == null || typeof value.breed === 'string') &&
    (weight === null || typeof weight === 'number') &&
    (value.microchipNumber == null || typeof value.microchipNumber === 'string')
  );
};

const isPetListResponse = (value: unknown): value is Pet[] => {
  return Array.isArray(value) && value.every(isPet);
};

const isPetMedication = (value: unknown): value is PetMedication => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.strength === null || typeof value.strength === 'string') &&
    typeof value.dose === 'number' &&
    typeof value.unit === 'string' &&
    typeof value.route === 'string' &&
    Array.isArray(value.schedule) &&
    typeof value.withFood === 'boolean' &&
    (value.instructions === null || typeof value.instructions === 'string') &&
    (value.prescribedBy === null || typeof value.prescribedBy === 'string') &&
    typeof value.active === 'boolean'
  );
};

const isPetDetail = (value: unknown): value is PetDetail => {
  if (!isPet(value) || !isRecord(value)) {
    return false;
  }

  return (
    (value.healthNotes === null || typeof value.healthNotes === 'string') &&
    (value.behaviourNotes === null || typeof value.behaviourNotes === 'string') &&
    Array.isArray(value.medications) &&
    value.medications.every(isPetMedication)
  );
};

export const fetchPetList = async (): Promise<Pet[]> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets`, { credentials: 'include' });
  if (!response.ok) {
    throw new PetApiError('Pet list request failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetListResponse(payload)) {
    throw new Error('Invalid pet list response');
  }
  return payload.map((pet) => normalizePet(pet as unknown as Record<string, unknown>));
};

export const fetchPetDetail = async (id: string): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}`, { credentials: 'include' });
  if (!response.ok) {
    throw new PetApiError('Pet detail request failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid pet detail response');
  }
  return normalizePetDetail(payload as unknown as Record<string, unknown>);
};

export interface UpdatePetProfileInput {
  type: PetType;
  gender: PetGender;
  age: number;
  ownerName: string;
  breed: string | null;
  weight: number | null;
  microchipNumber: string | null;
}

export const updatePetProfile = async (
  id: string,
  input: UpdatePetProfileInput,
): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new PetApiError('Pet profile update failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid pet update response');
  }
  return normalizePetDetail(payload as unknown as Record<string, unknown>);
};

const isPetAssignment = (value: unknown): value is PetAssignment => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.uuid === 'string' &&
    typeof value.petUuid === 'string' &&
    typeof value.petName === 'string' &&
    typeof value.employeeUuid === 'string' &&
    typeof value.employeeName === 'string' &&
    typeof value.assignmentDate === 'string' &&
    (value.shiftStart === null || typeof value.shiftStart === 'string') &&
    (value.shiftEnd === null || typeof value.shiftEnd === 'string')
  );
};

const isPetAssignmentListResponse = (value: unknown): value is PetAssignment[] => {
  return Array.isArray(value) && value.every(isPetAssignment);
};

export interface CreatePetAssignmentInput {
  employeeUuid: string;
  assignmentDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
}

export const fetchPetAssignments = async (id: string): Promise<PetAssignment[]> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/assignments`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new PetApiError('Pet assignment request failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetAssignmentListResponse(payload)) {
    throw new Error('Invalid pet assignment response');
  }
  return payload;
};

export const createPetAssignment = async (
  id: string,
  input: CreatePetAssignmentInput,
): Promise<PetAssignment> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new PetApiError('Pet assignment creation failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetAssignment(payload)) {
    throw new Error('Invalid pet assignment creation response');
  }
  return payload;
};

export const deletePetAssignment = async (id: string, assignmentUuid: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/assignments/${assignmentUuid}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new PetApiError('Pet assignment deletion failed', response.status);
  }
};

const putNotes = async (path: string, notes: string | null): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) {
    throw new PetApiError('Pet notes update failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid pet notes response');
  }
  return payload;
};

export const updatePetHealthNotes = async (id: string, notes: string | null): Promise<PetDetail> =>
  putNotes(`/admin/pets/${id}/health-notes`, notes);

export const updatePetBehaviourNotes = async (
  id: string,
  notes: string | null,
): Promise<PetDetail> => putNotes(`/admin/pets/${id}/behaviour-notes`, notes);

export interface MedicationInput {
  name: string;
  strength: string | null;
  dose: number;
  unit: string;
  route: string;
  schedule: string[];
  withFood: boolean;
  instructions: string | null;
  prescribedBy: string | null;
  active: boolean;
}

export const createPetMedication = async (
  id: string,
  input: MedicationInput,
): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/medications`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new PetApiError('Medication creation failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid medication creation response');
  }
  return payload;
};

export const updatePetMedication = async (
  id: string,
  medicationId: string,
  input: Partial<MedicationInput>,
): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/medications/${medicationId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new PetApiError('Medication update failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid medication update response');
  }
  return payload;
};

export const deletePetMedication = async (id: string, medicationId: string): Promise<PetDetail> => {
  const response = await fetch(`${API_BASE_URL}/admin/pets/${id}/medications/${medicationId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new PetApiError('Medication deletion failed', response.status);
  }

  const payload: unknown = await response.json();
  if (!isPetDetail(payload)) {
    throw new Error('Invalid medication deletion response');
  }
  return payload;
};

import { STAY_STATUS_COPY } from '../../pet-parent/components/stays/stayStatus';
import type { StayStatus } from '../../pet-parent/types/stays';

export const PET_TYPES = ['Dog', 'Cat', 'Other'] as const;
export type PetType = (typeof PET_TYPES)[number];

export const PET_GENDERS = ['Male', 'Female'] as const;
export type PetGender = (typeof PET_GENDERS)[number];

/**
 * The status of the pet's current or next stay (Backend contracts/pet.contract.ts), or no_stay.
 * The server names it with the same rule the owner's pages use.
 */
export type PetStayStatus = StayStatus | 'no_stay';

/** The words the owner reads for the same stay, so staff and owners never call it two things. */
export const PET_STATUS_LABELS: Record<PetStayStatus, string> = {
  ...STAY_STATUS_COPY.en,
  no_stay: 'No stays',
};

export const PET_STATUSES = Object.keys(PET_STATUS_LABELS) as PetStayStatus[];

/** Sorting by status puts the pets in our care first, then the ones arriving, then the rest. */
export const PET_STATUS_ORDER: Record<PetStayStatus, number> = {
  staying_now: 0,
  approved: 1,
  waiting_for_review: 2,
  did_not_arrive: 3,
  stay_ended: 4,
  refused: 5,
  cancelled: 6,
  no_stay: 7,
};

export interface Pet {
  id: string;
  name: string;
  status: PetStayStatus;
  checkInDate: string;
  checkOutDate: string | null;
  type: PetType;
  age: number;
  gender: PetGender;
  ownerName: string;
  breed?: string | null;
  weight?: number | null;
  microchipNumber?: string | null;
}

export interface PetAssignment {
  uuid: string;
  petUuid: string;
  petName: string;
  employeeUuid: string;
  employeeName: string;
  assignmentDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
}

export interface PetMedication {
  id: string;
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

export interface PetDetail extends Pet {
  healthNotes: string | null;
  behaviourNotes: string | null;
  medications: PetMedication[];
}

export const PET_SORT_COLUMNS = [
  'name',
  'status',
  'checkInDate',
  'checkOutDate',
  'type',
  'age',
  'gender',
  'ownerName',
] as const;
export type PetSortColumn = (typeof PET_SORT_COLUMNS)[number];

export type SortDirection = 'asc' | 'desc';

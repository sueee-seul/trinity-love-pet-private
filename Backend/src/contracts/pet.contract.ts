import type { StayStatus } from './stay-status.contract.js';

export const PET_TYPES = ['Dog', 'Cat', 'Other'] as const;
export type PetType = (typeof PET_TYPES)[number];

export const PET_GENDERS = ['Male', 'Female'] as const;
export type PetGender = (typeof PET_GENDERS)[number];

/**
 * The status of the pet's current or next stay, in the words its owner reads for that stay
 * (services/stay-status.ts), or `no_stay` for a pet with no stay that still stands.
 */
export type PetStayStatus = StayStatus | 'no_stay';

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
  breed: string | null;
  weight: number | null;
  microchipNumber: string | null;
}

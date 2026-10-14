import type { StayStatus } from './stay-status.contract.js';

export type Species = 'DOG' | 'CAT' | 'OTHER';

export interface OwnerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  address: string;
  dateOfBirth: string | null;
  emergencyContactNumber: string;
}

export interface Medication {
  id: string;
  petId: string;
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

export interface Stay {
  id: string;
  petId: string;
  facilityId: string;
  type: 'BOARDING' | 'DAYCARE';
  /** The same status My stays and Home use (services/stay-status.ts). */
  status: StayStatus;
  startAt: string;
  endAt: string;
  runName: string | null;
  facility: { id: string; name: string; suburb: string } | null;
}

export interface ParentPet {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  sex: 'male' | 'female' | '' | null;
  desexed: boolean;
  weightKg: number | null;
  colour: string | null;
  microchip: string | null;
  dietNotes: string | null;
  allergies: string[];
  behaviourNotes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  emergencyContact: string | null;
  medications: Medication[];
  stays: Stay[];
}

export interface ParentProfile {
  owner: OwnerProfile;
  pets: ParentPet[];
}

/**
 * Fields a parent may change about themselves. Email is not one of them. The address and the
 * emergency contact may be left empty (null): the booking form no longer asks for either.
 */
export type OwnerEditableFields = Pick<
  OwnerProfile,
  'fullName' | 'phone' | 'avatarUrl' | 'dateOfBirth'
> & {
  address: string | null;
  emergencyContactNumber: string | null;
};

export type PetWritableFields = Omit<ParentPet, 'id' | 'ownerId' | 'medications' | 'stays'>;

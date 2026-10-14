import type { StayStatus } from '../types/stays';

export type Species = 'DOG' | 'CAT' | 'OTHER';

export interface OwnerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  address: string;
  dateOfBirth?: string | null;
  emergencyContactNumber: string;
}

export interface OwnerProfileEditInput extends Partial<
  Pick<
    OwnerProfile,
    'fullName' | 'phone' | 'avatarUrl' | 'address' | 'dateOfBirth' | 'emergencyContactNumber'
  >
> {
  avatarFile?: File | null;
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  strength?: string | null;
  dose: number;
  unit: string;
  route: string;
  schedule: string[];
  withFood: boolean;
  instructions?: string | null;
  prescribedBy?: string | null;
  active: boolean;
}

export interface Stay {
  id: string;
  petId: string;
  facilityId: string;
  type: 'BOARDING' | 'DAYCARE';
  /** The same status My stays and Home show. */
  status: StayStatus;
  startAt: string;
  endAt: string;
  runName?: string | null;
  facility?: { id: string; name: string; suburb: string };
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed?: string | null;
  photoUrl?: string | null;
  birthDate?: string | null;
  sex?: 'male' | 'female' | '' | null;
  desexed: boolean;
  weightKg?: number | null;
  colour?: string | null;
  microchip?: string | null;
  dietNotes?: string | null;
  allergies: string[];
  behaviourNotes?: string | null;
  vetName?: string | null;
  vetPhone?: string | null;
  emergencyContact?: string | null;
  medications: Medication[];
  stays: Stay[];
}

/** Exactly what `GET /api/parent/profile` returns. Nothing is held locally. */
export interface ParentProfileState {
  owner: OwnerProfile;
  pets: Pet[];
}

export type PetInput = Omit<Pet, 'id' | 'ownerId' | 'medications' | 'stays'>;

export interface PetFormInput extends PetInput {
  photoFile?: File | null;
}

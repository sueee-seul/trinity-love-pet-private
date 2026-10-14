// Pet and service shapes returned by GET /api/petparent/pets and the
// concierge catalogue. They follow the pets and services tables, adapted to
// camelCase for the frontend.

export type Species = 'dog' | 'cat' | 'other';

/** Mirrors `SavedPetRecord` in Backend/src/services/petparent.booking.ts. */
export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  age?: number;
  weight?: number;
  imageUrl?: string;
  /** false once the pet has finished a stay our manager approved; null when that is not known. */
  firstTimeBoarding: false | null;
  /** true while staff keep an active medication on file; null means "ask", never "no". */
  needsMedication: true | null;
}

export type ServiceCategory = 'boarding_rate' | 'food' | 'addon';

export interface Service {
  id: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  price: number;
  priceUnit: string; // e.g. "per night", "per stay", "per day"
  compulsory: boolean;
}

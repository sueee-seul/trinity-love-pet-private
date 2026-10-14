export const FACILITY_SIZES = ['SOLO', 'SMALL', 'MEDIUM', 'LARGE'] as const;
export type FacilitySize = (typeof FACILITY_SIZES)[number];

export interface Facility {
  id: string;
  name: string;
  suburb: string | null;
  city: string | null;
  size: FacilitySize;
  capacity: number;
  address: string;
  phone: string | null;
  email: string | null;
  about: string | null;
}

/** Everything a manager may change. `id` is deliberately absent. */
export type FacilityEditableFields = Omit<Facility, 'id'>;

import { API_BASE_URL } from '../../../shared/api';

const FACILITIES_URL = `${API_BASE_URL}/admin/facilities`;

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

export type FacilityEdit = Omit<Facility, 'id'>;

export class FacilityApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FacilityApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const messageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Empty or non-JSON body.
  }
  return fallback;
};

const isFacility = (value: unknown): value is Facility =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.capacity === 'number' &&
  typeof value.address === 'string' &&
  FACILITY_SIZES.some((size) => size === value.size);

export const fetchFacilities = async (): Promise<Facility[]> => {
  const response = await fetch(FACILITIES_URL, { credentials: 'include' });
  if (!response.ok) {
    throw new FacilityApiError(
      await messageFrom(response, 'Could not load the facilities'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isFacility)) {
    throw new FacilityApiError('The server sent a facility list it could not read', 500);
  }
  return payload;
};

export const saveFacility = async (id: string, changes: FacilityEdit): Promise<Facility> => {
  const response = await fetch(`${FACILITIES_URL}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if (!response.ok) {
    throw new FacilityApiError(
      await messageFrom(response, 'Could not save the facility'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isFacility(payload)) {
    throw new FacilityApiError('The server sent a facility it could not read', 500);
  }
  return payload;
};

// Thin fetch client shared by the pet-parent pages and the concierge.
//
// Every call assumes a signed-in pet owner (session cookie). The pet owner id
// is never sent from the client: the server derives it from the session.
// New bookings are made through the concierge checkout, not from here.
import { API_BASE_URL } from '../../../shared/api';
import type { PetStay } from '../types/stays';
import { ApiError } from './apiError';

export const API_BASE = API_BASE_URL ?? '/api';

// Re-exported: callers import the error from the client that throws it.
export { ApiError };

// Exported: the homepage API client (homeApi.ts) reuses this rather than
// duplicating its own fetch wrapper.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // A FormData body (a file upload) must let the browser write its own multipart Content-Type,
  // which carries the boundary; every other body here is JSON.
  const defaultHeaders: Record<string, string> =
    init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // sends the session cookie the pet-owner id is derived from
    headers: {
      ...defaultHeaders,
      ...init?.headers,
    },
    ...init,
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // response wasn't JSON (e.g. a plain-text 500), so leave body as null
    }
    const errorField =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : null;
    const nestedMessage =
      errorField && typeof errorField === 'object' && 'message' in errorField
        ? String((errorField as { message: unknown }).message)
        : null;
    const flatMessage =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null;
    const message =
      nestedMessage || flatMessage || `Request to ${path} failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  // 204 No Content etc.: nothing to parse
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

/**
 * GET /api/petparent/bookings
 *
 * Every paid booking for the signed-in pet owner, one entry per pet. A
 * shared multi-pet booking produces one entry per pet, each with its own
 * dates, services, caring info, total and the manager's decision (`status`,
 * `reviewStatus`, `refusalReason`). Powers the "My Stays" page and its
 * booking-details modal.
 *
 * Returns: PetStay[]
 */
export function fetchMyBookings(): Promise<PetStay[]> {
  return request<PetStay[]>('/petparent/bookings');
}

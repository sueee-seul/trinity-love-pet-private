// Thin fetch client for the pet-parent Live Care dashboard.
//
//   GET /api/petparent/live-care                          -> LiveCareData (auto-resolves the stay to show)
//   GET /api/petparent/live-care/:bookingPetId?date=...    -> LiveCareData for that stay/day
//
// Both assume a signed-in pet owner (session cookie), same as bookingApi.ts.
import { API_BASE_URL } from '../../../shared/api';
import { ApiError } from './bookingApi';
import type { LiveCareData } from '../types/liveCare';
import { currentPortalLocale } from '../i18n/portalLocale';

const API_BASE = API_BASE_URL ?? '/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // response wasn't JSON, so leave body as null
    }
    const errorField =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : null;
    const message =
      errorField && typeof errorField === 'object' && 'message' in errorField
        ? String((errorField as { message: unknown }).message)
        : `Request to ${path} failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return (await res.json()) as T;
}

/** Turns the relative photo path the backend returns (e.g.
 * `/tasks/{id}/photos/{name}?inline=1`) into a URL the browser can load. */
function withPhotoUrls(data: LiveCareData): LiveCareData {
  return {
    ...data,
    entries: data.entries.map((entry) =>
      entry.photos ? { ...entry, photos: entry.photos.map((path) => `${API_BASE}${path}`) } : entry,
    ),
  };
}

/**
 * Fetches the Live Care dashboard for one stay/day.
 *
 * @param bookingPetId - Omit to let the server resolve the pet parent's
 *   current stay (in progress today, else the soonest upcoming one, else the
 *   most recently completed one).
 * @param date - 'YYYY-MM-DD'. Omit to let the server pick a default (today,
 *   if inside the stay).
 *
 * Throws ApiError (404, body `{ error: { code: 'NO_STAY_FOUND', ... } }`)
 * when the pet parent has no stay to show.
 */
export function fetchLiveCare(bookingPetId?: string, date?: string): Promise<LiveCareData> {
  const path = bookingPetId ? `/petparent/live-care/${bookingPetId}` : '/petparent/live-care';
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  // A parent reading Chinese gets each staff note translated beside the original.
  if (currentPortalLocale() === 'zh') params.set('lang', 'zh');
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<LiveCareData>(`${path}${query}`).then(withPhotoUrls);
}

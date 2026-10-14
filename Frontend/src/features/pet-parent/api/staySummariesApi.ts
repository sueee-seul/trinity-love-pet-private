// Thin fetch client for the updates a stay sent its parent, shown on Live care and the homepage.
//
//   GET /api/petparent/stays/:bookingPetId/summaries -> { summaries: StaySummary[] } newest first
//
// Assumes a signed-in pet owner (session cookie), same as liveCareApi.ts. The server answers 404
// for a stay that is not this owner's.
import { API_BASE, request } from './bookingApi';
import type { StaySummary } from '../types/liveCare';

interface StaySummariesResponse {
  summaries: StaySummary[];
}

/** Turns the relative media path the server returns (`/tasks/{id}/photos/{name}?inline=1`) into
 * a URL the browser can load, as liveCareApi.ts does for the timeline's photos. */
const withPhotoUrl = (summary: StaySummary): StaySummary => ({
  ...summary,
  photoPath: summary.photoPath === null ? null : `${API_BASE}${summary.photoPath}`,
  media: summary.media ? { ...summary.media, url: `${API_BASE}${summary.media.url}` } : null,
});

/** Every daily update and stay report of one stay, newest first. */
export function fetchStaySummaries(bookingPetId: string): Promise<StaySummary[]> {
  return request<StaySummariesResponse>(
    `/petparent/stays/${encodeURIComponent(bookingPetId)}/summaries`,
  ).then((response) => response.summaries.map(withPhotoUrl));
}

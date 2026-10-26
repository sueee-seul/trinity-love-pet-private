import type {
  AddOnCatalogue,
  AddOnInput,
  CancellationPreview,
  CancellationResult,
  CancelStayInput,
  ChangeTimesInput,
  ExtendStayInput,
  ExtensionPreview,
  NewDates,
  ReschedulePreview,
  RescheduleResult,
  RescheduleStayInput,
  StayChangeRequest,
} from '../types/stayChanges';
import { request } from './bookingApi';

// A signed-in pet parent changing their own stay. Each change is priced first (GET) so the guest
// sees the exact cost before confirming (POST); the POST carries the amount the guest saw, and the
// server decides both and refuses to charge a different amount.

const stayPath = (bookingId: string, action: string): string =>
  `/petparent/bookings/${encodeURIComponent(bookingId)}/${action}`;

const withQuery = (path: string, query: Record<string, string>): string =>
  `${path}?${new URLSearchParams(query).toString()}`;

const post = <T>(path: string, body: unknown, method = 'POST'): Promise<T> =>
  request<T>(path, { method, body: JSON.stringify(body) });

export const previewCancellation = (bookingId: string): Promise<CancellationPreview> =>
  request<CancellationPreview>(stayPath(bookingId, 'cancellation'));

export const cancelStay = (
  bookingId: string,
  input: CancelStayInput = {},
): Promise<CancellationResult> => post(stayPath(bookingId, 'cancel'), input);

export const previewReschedule = (bookingId: string, dates: NewDates): Promise<ReschedulePreview> =>
  request<ReschedulePreview>(withQuery(stayPath(bookingId, 'reschedule'), { ...dates }));

export const rescheduleStay = (
  bookingId: string,
  input: RescheduleStayInput,
): Promise<RescheduleResult> => post(stayPath(bookingId, 'reschedule'), input);

// ----- While the pet is staying -----------------------------------------------------------------

export const previewExtension = (bookingId: string, endDate: string): Promise<ExtensionPreview> =>
  request<ExtensionPreview>(withQuery(stayPath(bookingId, 'extension'), { endDate }));

/** Asks our manager for more nights; nothing changes until they approve. */
export const requestExtension = (
  bookingId: string,
  input: ExtendStayInput,
): Promise<StayChangeRequest> => post(stayPath(bookingId, 'extension'), input);

export const fetchAddOnCatalogue = (bookingId: string): Promise<AddOnCatalogue> =>
  request<AddOnCatalogue>(stayPath(bookingId, 'add-ons'));

/** Asks our manager for an add-on on a day of the stay. */
export const requestAddOn = (
  bookingId: string,
  bookingPetId: string,
  input: AddOnInput,
): Promise<StayChangeRequest> =>
  post(stayPath(bookingId, `pets/${encodeURIComponent(bookingPetId)}/add-ons`), input);

/** Asks our manager for a new check-in or check-out time. */
export const requestTimes = (
  bookingId: string,
  bookingPetId: string,
  input: ChangeTimesInput,
): Promise<StayChangeRequest> =>
  post(stayPath(bookingId, `pets/${encodeURIComponent(bookingPetId)}/times`), input, 'PATCH');

/** The parent's change requests and their answers, newest first. */
export const fetchStayChangeRequests = (): Promise<StayChangeRequest[]> =>
  request<StayChangeRequest[]>('/petparent/stay-change-requests');

/** Takes back a request our manager has not decided yet. */
export const withdrawStayChangeRequest = (requestId: string): Promise<{ withdrawn: true }> =>
  post(`/petparent/stay-change-requests/${encodeURIComponent(requestId)}/withdraw`, {});

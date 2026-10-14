import type {
  AddOnCatalogue,
  AddOnInput,
  AddOnResult,
  CancellationPreview,
  CancellationResult,
  CancelStayInput,
  ChangeTimesInput,
  ChangeTimesResult,
  ExtendStayInput,
  ExtensionPreview,
  ExtensionResult,
  NewDates,
  ReschedulePreview,
  RescheduleResult,
  RescheduleStayInput,
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

export const extendStay = (bookingId: string, input: ExtendStayInput): Promise<ExtensionResult> =>
  post(stayPath(bookingId, 'extension'), input);

export const fetchAddOnCatalogue = (bookingId: string): Promise<AddOnCatalogue> =>
  request<AddOnCatalogue>(stayPath(bookingId, 'add-ons'));

export const bookAddOn = (
  bookingId: string,
  bookingPetId: string,
  input: AddOnInput,
): Promise<AddOnResult> =>
  post(stayPath(bookingId, `pets/${encodeURIComponent(bookingPetId)}/add-ons`), input);

export const changeStayTimes = (
  bookingId: string,
  bookingPetId: string,
  input: ChangeTimesInput,
): Promise<ChangeTimesResult> =>
  post(stayPath(bookingId, `pets/${encodeURIComponent(bookingPetId)}/times`), input, 'PATCH');

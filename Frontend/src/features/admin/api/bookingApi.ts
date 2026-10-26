import { API_BASE_URL } from '../../../shared/api';
import type {
  CheckInOutcome,
  FinishCheckInResponse,
  ManagerBookingRecord,
  ManagerStayChangeRequest,
  StaffReschedule,
  StaffRescheduleResponse,
} from '../types/booking';

const BOOKINGS_BASE_URL = `${API_BASE_URL}/admin/bookings`;

/**
 * The certificate a parent uploaded for one stay. Employee sign-in only: the link works with the
 * staff session cookie and is never a public file address.
 */
export const vaccinationCertificateUrl = (bookingPetsUuid: string): string =>
  `${API_BASE_URL}/admin/vaccination-certificates/${encodeURIComponent(bookingPetsUuid)}`;

export class BookingApiError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
  }
}

const errorMessageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
    ) {
      return (payload as { error: { message: string } }).error.message;
    }
  } catch {
    // Body was empty or not JSON; the fallback is the best available message.
  }
  return fallback;
};

/** Sends one request with the session cookie; a failure carries the server's own message. */
const send = async (
  path: string,
  init: { method: 'GET' | 'PATCH' | 'POST'; body?: unknown },
  fallback: string,
): Promise<Response> => {
  const response = await fetch(`${BOOKINGS_BASE_URL}${path}`, {
    method: init.method,
    credentials: 'include',
    ...(init.body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    throw new BookingApiError(await errorMessageFrom(response, fallback), response.status);
  }
  return response;
};

export const fetchManagerBookings = async (): Promise<ManagerBookingRecord[]> => {
  const response = await send('', { method: 'GET' }, 'Unable to load bookings');
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Invalid bookings response');
  }
  return payload as ManagerBookingRecord[];
};

export const approveBookingOnServer = async (bookingPetsUuid: string): Promise<void> => {
  await send(`/${bookingPetsUuid}/approve`, { method: 'PATCH' }, 'Could not approve this booking');
};

export const refuseBookingOnServer = async (
  bookingPetsUuid: string,
  reason: string,
): Promise<void> => {
  await send(
    `/${bookingPetsUuid}/refuse`,
    { method: 'PATCH', body: { reason } },
    'Could not refuse this booking',
  );
};

export const undoBookingReviewOnServer = async (bookingPetsUuid: string): Promise<void> => {
  await send(`/${bookingPetsUuid}/undo`, { method: 'PATCH' }, 'Could not undo this decision');
};

export const recordArrivalOnServer = async (
  bookingPetsUuid: string,
  outcome: CheckInOutcome,
): Promise<void> => {
  await send(
    `/${bookingPetsUuid}/check-in`,
    { method: 'PATCH', body: { outcome } },
    'Could not record this arrival',
  );
};

export const finishCheckInOnServer = async (bookingId: string): Promise<FinishCheckInResponse> => {
  const response = await send(
    `/by-booking/${bookingId}/finish-check-in`,
    { method: 'POST' },
    'Could not finish check-in',
  );
  return (await response.json()) as FinishCheckInResponse;
};

export const rescheduleWithoutChargeOnServer = async (
  bookingId: string,
  change: StaffReschedule,
): Promise<StaffRescheduleResponse> => {
  const response = await send(
    `/by-booking/${bookingId}/reschedule`,
    { method: 'POST', body: change },
    'Could not move this stay',
  );
  return (await response.json()) as StaffRescheduleResponse;
};

export const cancelWithoutFeeOnServer = async (
  bookingId: string,
  reason: string,
): Promise<void> => {
  await send(
    `/by-booking/${bookingId}/cancel`,
    { method: 'POST', body: { reason } },
    'Could not cancel this booking',
  );
};

// ----- Change requests for stays under way ------------------------------------------------------

export const fetchStayChangeRequests = async (): Promise<ManagerStayChangeRequest[]> => {
  const response = await send(
    '/change-requests',
    { method: 'GET' },
    'Unable to load change requests',
  );
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Invalid change requests response');
  return payload as ManagerStayChangeRequest[];
};

/** Makes the change; the server says why when it can no longer be made. */
export const approveStayChangeRequest = async (requestId: string): Promise<void> => {
  await send(
    `/change-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'PATCH' },
    'Could not approve this request',
  );
};

export const refuseStayChangeRequest = async (requestId: string, reason: string): Promise<void> => {
  await send(
    `/change-requests/${encodeURIComponent(requestId)}/refuse`,
    { method: 'PATCH', body: { reason } },
    'Could not refuse this request',
  );
};

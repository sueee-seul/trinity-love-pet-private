import { create } from 'zustand';
import {
  approveBookingOnServer,
  cancelWithoutFeeOnServer,
  finishCheckInOnServer,
  recordArrivalOnServer,
  refuseBookingOnServer,
  rescheduleWithoutChargeOnServer,
  undoBookingReviewOnServer,
  fetchManagerBookings,
} from '../api/bookingApi';
import type {
  CheckInOutcome,
  FinishCheckInResponse,
  ManagerBookingRecord,
  StaffReschedule,
  StaffRescheduleResponse,
} from '../types/booking';
/**
 * A decision can move money (pay at request: the confirmed pets are charged once nobody waits) and
 * records the deciding manager by name, so after the quick local update the list is read again,
 * quietly, for the server's own payment state and name. A failed re-read keeps the local update.
 */
const rereadQuietly = async (apply: (bookings: ManagerBookingRecord[]) => void): Promise<void> => {
  try {
    apply(await fetchManagerBookings());
  } catch (error: unknown) {
    console.error('Bookings could not be read again after a decision', error);
  }
};

export type BookingSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

interface BookingStoreState {
  bookingByUuid: Record<string, ManagerBookingRecord>;
  bookingUuids: string[];
  snapshotStatus: BookingSnapshotStatus;
  snapshotError: string | null;
  loadBookings: () => Promise<void>;
  approveBooking: (bookingPetsUuid: string) => Promise<void>;
  refuseBooking: (bookingPetsUuid: string, reason: string) => Promise<void>;
  undoReview: (bookingPetsUuid: string) => Promise<void>;
  recordArrival: (bookingPetsUuid: string, outcome: CheckInOutcome) => Promise<void>;
  /** Charges the booking once; the list is then read again, since the server settled it. */
  finishCheckIn: (bookingId: string) => Promise<FinishCheckInResponse>;
  cancelWithoutFee: (bookingId: string, reason: string) => Promise<void>;
  rescheduleWithoutCharge: (
    bookingId: string,
    change: StaffReschedule,
  ) => Promise<StaffRescheduleResponse>;
}

const snapshotOf = (
  bookings: ManagerBookingRecord[],
): Pick<BookingStoreState, 'bookingByUuid' | 'bookingUuids'> => ({
  bookingByUuid: Object.fromEntries(bookings.map((b) => [b.booking_pets_uuid, b])),
  bookingUuids: bookings.map((b) => b.booking_pets_uuid),
});

export const useBookingStore = create<BookingStoreState>((set) => ({
  bookingByUuid: {},
  bookingUuids: [],
  snapshotStatus: 'idle',
  snapshotError: null,

  loadBookings: async (): Promise<void> => {
    set({ snapshotStatus: 'loading', snapshotError: null });
    try {
      const bookings = await fetchManagerBookings();
      set({ ...snapshotOf(bookings), snapshotStatus: 'ready' });
    } catch (error) {
      console.error('Failed to load bookings', error);
      set({ snapshotStatus: 'error', snapshotError: 'Unable to load bookings. Please try again.' });
    }
  },

  recordArrival: async (bookingPetsUuid, outcome): Promise<void> => {
    await recordArrivalOnServer(bookingPetsUuid, outcome);
    set((state) => {
      const booking = state.bookingByUuid[bookingPetsUuid];
      if (!booking) return state;
      return {
        bookingByUuid: {
          ...state.bookingByUuid,
          [bookingPetsUuid]: {
            ...booking,
            booking: { ...booking.booking, check_in_outcome: outcome },
          },
        },
      };
    });
  },

  // Money moved on the server, so the list is read again rather than guessed; quietly, so the
  // page keeps showing the bookings meanwhile.
  finishCheckIn: async (bookingId): Promise<FinishCheckInResponse> => {
    const result = await finishCheckInOnServer(bookingId);
    set(snapshotOf(await fetchManagerBookings()));
    return result;
  },

  cancelWithoutFee: async (bookingId, reason): Promise<void> => {
    await cancelWithoutFeeOnServer(bookingId, reason);
    set(snapshotOf(await fetchManagerBookings()));
  },

  rescheduleWithoutCharge: async (bookingId, change): Promise<StaffRescheduleResponse> => {
    const moved = await rescheduleWithoutChargeOnServer(bookingId, change);
    set(snapshotOf(await fetchManagerBookings()));
    return moved;
  },

  approveBooking: async (bookingPetsUuid): Promise<void> => {
    await approveBookingOnServer(bookingPetsUuid);
    set((state) => {
      const booking = state.bookingByUuid[bookingPetsUuid];
      if (!booking) return state;
      return {
        bookingByUuid: {
          ...state.bookingByUuid,
          [bookingPetsUuid]: {
            ...booking,
            booking: {
              ...booking.booking,
              manager_review_status: 'approved',
              refusal_reason: null,
              reviewer_name: null,
            },
          },
        },
      };
    });
    await rereadQuietly((bookings) => set(snapshotOf(bookings)));
  },

  refuseBooking: async (bookingPetsUuid: string, reason): Promise<void> => {
    await refuseBookingOnServer(bookingPetsUuid, reason);
    set((state) => {
      const booking = state.bookingByUuid[bookingPetsUuid];
      if (!booking) return state;
      return {
        bookingByUuid: {
          ...state.bookingByUuid,
          [bookingPetsUuid]: {
            ...booking,
            booking: {
              ...booking.booking,
              manager_review_status: 'refused',
              refusal_reason: reason,
              reviewer_name: null,
            },
          },
        },
      };
    });
    await rereadQuietly((bookings) => set(snapshotOf(bookings)));
  },
  undoReview: async (bookingPetsUuid: string): Promise<void> => {
    await undoBookingReviewOnServer(bookingPetsUuid);
    set((state) => {
      const booking = state.bookingByUuid[bookingPetsUuid];
      if (!booking) return state;
      return {
        bookingByUuid: {
          ...state.bookingByUuid,
          [bookingPetsUuid]: {
            ...booking,
            booking: {
              ...booking.booking,
              manager_review_status: 'pending',
              refusal_reason: null,
              reviewer_name: null,
            },
          },
        },
      };
    });
    await rereadQuietly((bookings) => set(snapshotOf(bookings)));
  },
}));

import { useEffect } from 'react';
import { useBookingStore } from '../store/bookingStore';
import type { ManagerBookingRecord } from '../types/booking';

interface BookingListData {
  bookings: ManagerBookingRecord[];
  loading: boolean;
  error: string | null;
}

/** New requests appear on the Booking tab without a reload: the list is read again this often. */
export const BOOKING_LIST_REFRESH_MS = 15_000;

export const useBookingListData = (): BookingListData => {
  const bookingByUuid = useBookingStore((state) => state.bookingByUuid);
  const bookingUuids = useBookingStore((state) => state.bookingUuids);
  const snapshotStatus = useBookingStore((state) => state.snapshotStatus);
  const snapshotError = useBookingStore((state) => state.snapshotError);
  const loadBookings = useBookingStore((state) => state.loadBookings);
  const refreshBookings = useBookingStore((state) => state.refreshBookings);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  // Only while the tab is visible, and once more on returning to it.
  useEffect(() => {
    const refreshWhileVisible = (): void => {
      if (document.visibilityState === 'visible') void refreshBookings();
    };
    const timer = window.setInterval(refreshWhileVisible, BOOKING_LIST_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, [refreshBookings]);

  return {
    bookings: bookingUuids
      .map((uuid) => bookingByUuid[uuid])
      .filter((b): b is ManagerBookingRecord => Boolean(b)),
    loading: snapshotStatus === 'idle' || snapshotStatus === 'loading',
    error: snapshotStatus === 'error' ? snapshotError : null,
  };
};

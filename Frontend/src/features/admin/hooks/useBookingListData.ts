import { useEffect } from 'react';
import { useBookingStore } from '../store/bookingStore';
import type { ManagerBookingRecord } from '../types/booking';

interface BookingListData {
  bookings: ManagerBookingRecord[];
  loading: boolean;
  error: string | null;
}

export const useBookingListData = (): BookingListData => {
  const bookingByUuid = useBookingStore((state) => state.bookingByUuid);
  const bookingUuids = useBookingStore((state) => state.bookingUuids);
  const snapshotStatus = useBookingStore((state) => state.snapshotStatus);
  const snapshotError = useBookingStore((state) => state.snapshotError);
  const loadBookings = useBookingStore((state) => state.loadBookings);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  return {
    bookings: bookingUuids
      .map((uuid) => bookingByUuid[uuid])
      .filter((b): b is ManagerBookingRecord => Boolean(b)),
    loading: snapshotStatus === 'idle' || snapshotStatus === 'loading',
    error: snapshotStatus === 'error' ? snapshotError : null,
  };
};

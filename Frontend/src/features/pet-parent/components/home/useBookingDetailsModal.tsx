import { useEffect, useState, type ReactElement } from 'react';
import { fetchMyBookings } from '../../api/bookingApi';
import type { PetStay } from '../../types/stays';
import { BookingDetailsModal } from '../stays/BookingDetailsModal';

/**
 * "View booking" on the homepage opens the same details modal as My Stays,
 * reusing its component and its data (`GET /petparent/bookings`) rather than
 * duplicating either. Prefetches once there is an upcoming stay to view, so
 * the modal is ready by the time the parent clicks; `openBookingDetails` also
 * triggers a fetch itself in case that click lands first.
 */
export function useBookingDetailsModal(enabled: boolean): {
  openBookingDetails: (bookingPetId: string) => void;
  modal: ReactElement;
} {
  const [stays, setStays] = useState<PetStay[]>([]);
  const [openBookingPetId, setOpenBookingPetId] = useState<string | null>(null);

  const load = (): void => {
    fetchMyBookings().then(setStays, () => undefined);
  };

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const openBookingDetails = (bookingPetId: string): void => {
    setOpenBookingPetId(bookingPetId);
    if (stays.length === 0) load();
  };

  const stay = stays.find((candidate) => candidate.bookingPetId === openBookingPetId) ?? null;

  return {
    openBookingDetails,
    modal: <BookingDetailsModal stay={stay} onClose={() => setOpenBookingPetId(null)} />,
  };
}

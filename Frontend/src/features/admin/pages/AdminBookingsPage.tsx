import { useMemo, useState, type ReactElement } from 'react';
import { BookingApiError } from '../api/bookingApi';
import { BookingCard } from '../components/booking/BookingCard';
import { BookingTabs } from '../components/booking/BookingTabs';
import { DeskAlerts } from '../components/booking/DeskAlerts';
import { useBookingListData } from '../hooks/useBookingListData';
import { useBookingStore } from '../store/bookingStore';
import {
  BOOKING_TAB_TO_STATUS,
  type CheckInOutcome,
  type FinishCheckInResponse,
  type ManagerBookingRecord,
  type ManagerBookingTab,
  type StaffReschedule,
} from '../types/booking';
import { formatIsoDay, formatNzd } from '../utils/bookingDesk';
import { orderBookingsForTab } from '../utils/bookingOrder';
import { AdminPage, AdminPageHeader } from '../components/layout/AdminPage';

type Notice = { tone: 'done' | 'problem'; text: string };

const finishNotice = ({ result, amount }: FinishCheckInResponse): Notice => {
  switch (result) {
    case 'charged':
      return {
        tone: 'done',
        text: `Charged ${formatNzd(amount)}. The rest of the hold was released.`,
      };
    case 'released':
      return { tone: 'done', text: 'Nothing was due. The card hold was released.' };
    case 'declined':
      return {
        tone: 'problem',
        text: `The card was declined. Take ${formatNzd(amount)} at the desk.`,
      };
    case 'card_failed':
      return {
        tone: 'problem',
        text: `The card hold failed earlier. Take ${formatNzd(amount)} at the desk.`,
      };
  }
};

const groupByBooking = (records: ManagerBookingRecord[]): Map<string, ManagerBookingRecord[]> => {
  const groups = new Map<string, ManagerBookingRecord[]>();
  for (const record of records) {
    groups.set(record.booking_id, [...(groups.get(record.booking_id) ?? []), record]);
  }
  return groups;
};

interface AdminBookingsPageProps {
  /** Staff: every booking, the arrivals and finishing check-in; no decisions (BookingCard). */
  staffDesk?: boolean;
}

export function AdminBookingsPage({ staffDesk = false }: AdminBookingsPageProps): ReactElement {
  const [activeTab, setActiveTab] = useState<ManagerBookingTab>('Booking');
  const { bookings, loading, error } = useBookingListData();
  const approveBooking = useBookingStore((state) => state.approveBooking);
  const refuseBooking = useBookingStore((state) => state.refuseBooking);
  const undoReview = useBookingStore((state) => state.undoReview);
  const recordArrival = useBookingStore((state) => state.recordArrival);
  const finishCheckIn = useBookingStore((state) => state.finishCheckIn);
  const cancelWithoutFee = useBookingStore((state) => state.cancelWithoutFee);
  const rescheduleWithoutCharge = useBookingStore((state) => state.rescheduleWithoutCharge);
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The desk day is read when the page opens; reopening the page moves it on.
  const [now] = useState(() => new Date());

  const counts = useMemo(
    () => ({
      Booking: bookings.filter((b) => b.booking.manager_review_status === 'pending').length,
      Approve: bookings.filter((b) => b.booking.manager_review_status === 'approved').length,
      Refuse: bookings.filter((b) => b.booking.manager_review_status === 'refused').length,
      Cancelled: bookings.filter((b) => b.booking.manager_review_status === 'cancelled').length,
    }),
    [bookings],
  );
  const petsByBooking = useMemo(() => groupByBooking(bookings), [bookings]);

  const visibleBookings = orderBookingsForTab(
    bookings.filter((b) => b.booking.manager_review_status === BOOKING_TAB_TO_STATUS[activeTab]),
    activeTab,
    now,
  );

  /** Booking id to the first card shown for it: booking-wide actions live on that card. */
  const firstVisibleCard = new Map<string, string>();
  for (const b of visibleBookings) {
    if (!firstVisibleCard.has(b.booking_id))
      firstVisibleCard.set(b.booking_id, b.booking_pets_uuid);
  }

  /** Runs one action with its card busy, and says how it went. */
  const run = async (
    cardUuid: string,
    action: () => Promise<Notice | null>,
    fallback: string,
  ): Promise<void> => {
    setBusyUuid(cardUuid);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (err) {
      console.error(fallback, err);
      setNotice({ tone: 'problem', text: err instanceof BookingApiError ? err.message : fallback });
    } finally {
      setBusyUuid(null);
    }
  };

  const handleApprove = (uuid: string): Promise<void> =>
    run(
      uuid,
      async () => {
        await approveBooking(uuid);
        return null;
      },
      'Could not approve this booking.',
    );

  const handleRefuse = (uuid: string, reason: string): Promise<void> =>
    run(
      uuid,
      async () => {
        await refuseBooking(uuid, reason);
        return null;
      },
      'Could not refuse this booking.',
    );

  const handleUndo = (uuid: string): Promise<void> =>
    run(
      uuid,
      async () => {
        await undoReview(uuid);
        return null;
      },
      'Could not undo this decision. Please try again.',
    );

  const handleRecordArrival = (uuid: string, outcome: CheckInOutcome): Promise<void> =>
    run(
      uuid,
      async () => {
        await recordArrival(uuid, outcome);
        return null;
      },
      'Could not record this arrival.',
    );

  const handleFinishCheckIn = (bookingId: string): Promise<void> =>
    run(
      firstVisibleCard.get(bookingId) ?? bookingId,
      async () => finishNotice(await finishCheckIn(bookingId)),
      'Could not finish check-in.',
    );

  const handleCancelWithoutFee = (bookingId: string, reason: string): Promise<void> =>
    run(
      firstVisibleCard.get(bookingId) ?? bookingId,
      async () => {
        await cancelWithoutFee(bookingId, reason);
        return {
          tone: 'done',
          text: 'Booking cancelled without a fee. The card hold was released.',
        };
      },
      'Could not cancel this booking.',
    );

  const handleRescheduleWithoutCharge = (
    bookingId: string,
    change: StaffReschedule,
  ): Promise<void> =>
    run(
      firstVisibleCard.get(bookingId) ?? bookingId,
      async () => {
        const moved = await rescheduleWithoutCharge(bookingId, change);
        return {
          tone: 'done',
          text: `Stay moved to ${formatIsoDay(moved.startDate)} without a charge. The guest keeps their free change.`,
        };
      },
      'Could not move this stay.',
    );

  return (
    <AdminPage width="reading">
      <AdminPageHeader
        title="Bookings"
        lead={
          staffDesk
            ? 'You can record arrivals and finish check-in. Only a manager can approve or refuse a stay, turn a pet away, or cancel or move a stay without a fee.'
            : undefined
        }
      />
      <DeskAlerts bookings={bookings} now={now} />
      <BookingTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {notice && (
        <p
          role={notice.tone === 'problem' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-[13px] ${
            notice.tone === 'problem'
              ? 'bg-status-danger-soft text-status-danger'
              : 'bg-status-success-soft text-status-success'
          }`}
        >
          {notice.text}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-notice-secondary">Loading...</p>
      ) : error ? (
        <p role="alert" className="py-10 text-center text-status-danger">
          {error}
        </p>
      ) : visibleBookings.length === 0 ? (
        <p className="py-10 text-center text-notice-secondary">No bookings in this tab.</p>
      ) : (
        <div className="space-y-4">
          {visibleBookings.map((booking) => (
            <BookingCard
              key={booking.booking_pets_uuid}
              booking={booking}
              petsOfBooking={petsByBooking.get(booking.booking_id) ?? [booking]}
              isFirstOfBooking={
                firstVisibleCard.get(booking.booking_id) === booking.booking_pets_uuid
              }
              now={now}
              onApprove={handleApprove}
              onRefuse={handleRefuse}
              onUndo={handleUndo}
              onRecordArrival={handleRecordArrival}
              onFinishCheckIn={handleFinishCheckIn}
              onCancelWithoutFee={handleCancelWithoutFee}
              onRescheduleWithoutCharge={handleRescheduleWithoutCharge}
              isBusy={busyUuid === booking.booking_pets_uuid}
              staffDesk={staffDesk}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}

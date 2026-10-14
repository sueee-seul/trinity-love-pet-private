import type { ReactElement } from 'react';
import type { ManagerBookingRecord } from '../../types/booking';
import {
  formatAucklandDay,
  isOnBooking,
  isOpenCardBooking,
  isUnrecordedArrival,
} from '../../utils/bookingDesk';

interface DeskAlertsProps {
  bookings: ManagerBookingRecord[];
  now: Date;
}

const dropOffDay = (record: ManagerBookingRecord): string =>
  record.booking.drop_off_at ? formatAucklandDay(new Date(record.booking.drop_off_at)) : 'no date';

/** One entry per booking, with every pet on it. */
const byBooking = (records: ManagerBookingRecord[]): ManagerBookingRecord[][] => {
  const groups = new Map<string, ManagerBookingRecord[]>();
  for (const record of records) {
    groups.set(record.booking_id, [...(groups.get(record.booking_id) ?? []), record]);
  }
  return Array.from(groups.values());
};

/**
 * What needs a manager today: arrivals from past drop-off days nobody recorded (nothing is charged
 * for a no-show until someone does), and card holds that failed before drop-off.
 */
export function DeskAlerts({ bookings, now }: DeskAlertsProps): ReactElement | null {
  const unrecorded = bookings.filter((record) => isUnrecordedArrival(record, now));
  const failedHolds = byBooking(
    bookings.filter(
      (record) =>
        isOnBooking(record) &&
        isOpenCardBooking(record) &&
        record.booking.card_guarantee?.status === 'failed',
    ),
  );
  if (unrecorded.length === 0 && failedHolds.length === 0) return null;

  return (
    <div className="space-y-3">
      {unrecorded.length > 0 && (
        <section
          aria-labelledby="desk-unrecorded"
          className="rounded-xl border border-border-soft bg-status-warning-soft p-4"
        >
          <h2 id="desk-unrecorded" className="type-card-title text-accent-foreground">
            Arrivals to record ({unrecorded.length})
          </h2>
          <p className="mt-1 type-meta text-notice-secondary">
            These drop-off days have passed. Record each pet as checked in, a no-show or one we
            couldn&apos;t take. Finishing check-in then settles what each booking owes.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 type-meta text-notice-primary">
            {unrecorded.map((record) => (
              <li key={record.booking_pets_uuid}>
                {record.pet.name} ({record.customer.name}), drop-off {dropOffDay(record)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {failedHolds.length > 0 && (
        <section
          aria-labelledby="desk-failed-holds"
          className="rounded-xl border border-border-soft bg-status-danger-soft p-4"
        >
          <h2 id="desk-failed-holds" className="type-card-title text-status-danger">
            Card holds that failed ({failedHolds.length})
          </h2>
          <p className="mt-1 type-meta text-notice-primary">
            The guest was emailed. Ask for another card before drop-off, or take payment at the
            desk.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 type-meta text-notice-primary">
            {failedHolds.map((pets) => {
              const [first] = pets;
              if (!first) return null;
              return (
                <li key={first.booking_id}>
                  {first.customer.name}: {pets.map((pet) => pet.pet.name).join(', ')}, drop-off{' '}
                  {dropOffDay(first)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

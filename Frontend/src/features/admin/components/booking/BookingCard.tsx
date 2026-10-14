import { useState, type ReactElement } from 'react';
import type { CheckInOutcome, ManagerBookingRecord, StaffReschedule } from '../../types/booking';
import {
  arrivalCanBeRecorded,
  aucklandDateOf,
  isOnBooking,
  formatNzd,
  isOpenCardBooking,
  OUTCOME_LABELS,
} from '../../utils/bookingDesk';
import { ArrivalPanel } from './ArrivalPanel';
import { BookingStatusBadge } from './BookingStatusBadge';
import { VaccinationCertificateLine } from './VaccinationCertificateLine';
import { CardGuaranteeNote } from './CardGuaranteeNote';
import { ExceptionCancel } from './ExceptionCancel';
import { ExceptionReschedule } from './ExceptionReschedule';
import { RefuseForm } from './RefuseForm';
import { Link } from 'react-router-dom';
import { daysUntilCheckIn, isUrgentReview } from '../../utils/bookingOrder';

interface BookingCardProps {
  booking: ManagerBookingRecord;
  /** Every pet on the same booking, this one included. */
  petsOfBooking: ManagerBookingRecord[];
  /** Booking-wide actions (finish check-in, cancel without a fee) show on one card only. */
  isFirstOfBooking: boolean;
  now: Date;
  onApprove: (bookingPetsUuid: string) => void;
  onRefuse: (bookingPetsUuid: string, reason: string) => void;
  onUndo: (bookingPetsUuid: string) => void;
  onRecordArrival: (bookingPetsUuid: string, outcome: CheckInOutcome) => void;
  onFinishCheckIn: (bookingId: string) => void;
  onCancelWithoutFee: (bookingId: string, reason: string) => void;
  onRescheduleWithoutCharge: (bookingId: string, change: StaffReschedule) => void;
  isBusy: boolean;
  /**
   * Staff work the desk: they record who arrived and finish check-in, whose charge the server
   * works out. Approving or refusing, undoing a decision, turning a pet away and cancelling or
   * moving a stay without a fee stay with a manager (the server refuses those calls from staff).
   */
  staffDesk?: boolean;
}

export function BookingCard({
  booking,
  petsOfBooking,
  isFirstOfBooking,
  now,
  onApprove,
  onRefuse,
  onUndo,
  onRecordArrival,
  onFinishCheckIn,
  onCancelWithoutFee,
  onRescheduleWithoutCharge,
  isBusy,
  staffDesk = false,
}: BookingCardProps): ReactElement {
  const [isRefusing, setIsRefusing] = useState(false);
  const handleUndoClick = (): void => {
    if (window.confirm('Are you sure you want to undo this decision? ')) {
      onUndo(booking.booking_pets_uuid);
    }
  };
  const { pet, customer } = booking;
  const info = booking.booking;
  const ci = info.booking_caring_info;
  const addonNames = info.services.addons.map((a) => a.services_name).join(', ');
  const status = info.manager_review_status;
  // check_in is an Auckland date, so "today" must be one too (a UTC date is a day behind until 1pm).
  const todayInAuckland = aucklandDateOf(now);
  const isOverdue =
    status === 'pending' && !!info.dates.check_in && info.dates.check_in < todayInAuckland;
  // Waiting for review with check-in 3 days away or less: framed so it is reviewed first.
  const urgentReview = isUrgentReview(booking, now);
  const checkInDays = daysUntilCheckIn(booking, now);
  const card = info.card_guarantee;
  const openCard = isOpenCardBooking(booking);
  const atDesk = arrivalCanBeRecorded(booking, now);
  const noPetArrived = petsOfBooking.every(
    (pet) => !isOnBooking(pet) || pet.booking.check_in_outcome === null,
  );
  const offerNoFeeCancel = openCard && isFirstOfBooking && isOnBooking(booking) && noPetArrived;

  return (
    <div
      className={
        urgentReview
          ? 'rounded-xl border-2 border-transparent p-4 shadow-card [background:linear-gradient(var(--color-surface-card),var(--color-surface-card))_padding-box,linear-gradient(135deg,var(--color-status-danger-soft),var(--color-status-danger))_border-box]'
          : 'rounded-xl border border-border-soft bg-surface-card p-4 shadow-card'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="type-card-title text-notice-primary">
            {pet.name}{' '}
            <span className="type-body font-normal text-notice-secondary">· {pet.type}</span>
          </h3>
          <p className="type-meta text-notice-secondary">Owner: {customer.name}</p>
          <p className="type-meta text-notice-secondary">
            {info.dates.check_in ?? 'No date'} to {info.dates.check_out ?? 'No date'}
            {isOverdue && (
              <span className="ml-2 inline-flex items-center rounded-full bg-status-danger-soft px-2 py-0.5 type-meta font-bold text-status-danger">
                OVERDUE
              </span>
            )}
            {urgentReview && !isOverdue && checkInDays !== null && (
              <span className="ml-2 inline-flex items-center rounded-full bg-status-warning-soft px-2 py-0.5 type-meta font-bold text-accent-foreground">
                {checkInDays === 0
                  ? 'CHECK-IN TODAY'
                  : `CHECK-IN IN ${checkInDays} DAY${checkInDays === 1 ? '' : 'S'}`}
              </span>
            )}
          </p>
        </div>
        <BookingStatusBadge status={status} />
      </div>
      {card && <CardGuaranteeNote card={card} />}
      {isFirstOfBooking && info.to_pay_at_check_out > 0 && (
        <p className="mt-1 type-meta font-semibold text-notice-primary">
          To pay at check-out: {formatNzd(info.to_pay_at_check_out)} (in-stay changes, no saved
          card)
        </p>
      )}
      {info.check_in_outcome && !atDesk && (
        <p className="mt-1 type-meta text-notice-primary">
          Arrival: {OUTCOME_LABELS[info.check_in_outcome]}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
            Service
          </p>
          <p className="mt-1 type-meta text-notice-primary">
            {info.services.boarding_rate?.services_name ?? 'None'}
          </p>
        </div>
        <div>
          <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
            Food
          </p>
          <p className="mt-1 type-meta text-notice-primary">
            {info.services.food?.services_name ?? 'None'}
          </p>
        </div>
        <div>
          <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
            Add-ons
          </p>
          <p className="mt-1 type-meta text-notice-primary">{addonNames || 'None'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ci.first_time_boarding && (
          <span className="rounded-full bg-status-success-soft px-2 py-0.5 type-meta font-semibold text-status-success">
            First-time boarding
          </span>
        )}
        {ci.crate_trained && (
          <span className="rounded-full bg-status-success-soft px-2 py-0.5 type-meta font-semibold text-status-success">
            Crate trained
          </span>
        )}
        {ci.allows_socialization && (
          <span className="rounded-full bg-status-success-soft px-2 py-0.5 type-meta font-semibold text-status-success">
            OK to socialize
          </span>
        )}
        {ci.fully_vaccinated && (
          <span className="rounded-full bg-status-success-soft px-2 py-0.5 type-meta font-semibold text-status-success">
            Fully vaccinated
          </span>
        )}
      </div>

      <VaccinationCertificateLine
        bookingPetsUuid={booking.booking_pets_uuid}
        hasCertificate={ci.has_vaccination_certificate}
        uploadedAt={ci.vaccination_document_uploaded_at}
      />

      <div className="mt-3 space-y-2">
        <div>
          <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
            Feeding routine
          </p>
          <p className="type-meta text-notice-primary">{ci.feeding_routine}</p>
        </div>
        {ci.medication_instructions && (
          <div>
            <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-status-danger">
              Medication instructions
            </p>
            <p className="type-meta text-status-danger">{ci.medication_instructions}</p>
          </div>
        )}
        {ci.other_notes && (
          <div>
            <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
              Other notes
            </p>
            <p className="type-meta text-notice-primary">{ci.other_notes}</p>
          </div>
        )}
        {ci.behavior_and_health_notes && (
          <div>
            <p className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-secondary">
              Behavior & health notes
            </p>
            <p className="type-meta text-notice-primary">{ci.behavior_and_health_notes}</p>
          </div>
        )}
      </div>

      {status === 'cancelled' && info.refusal_reason && (
        <p className="mt-3 rounded-lg bg-surface-cream px-3 py-2 type-meta text-notice-secondary">
          Cancelled: {info.refusal_reason}
        </p>
      )}

      {status === 'refused' && info.refusal_reason && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-status-danger-soft px-3 py-2 type-meta text-status-danger">
          <span>
            {info.reviewer_name ? `Refused by ${info.reviewer_name}` : 'Refused'}:{' '}
            {info.refusal_reason}
          </span>
          {!staffDesk && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleUndoClick}
              className="rounded-lg border border-status-danger px-3 py-1 type-meta font-semibold text-status-danger transition hover:bg-white disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {status === 'pending' && !staffDesk && (
        <div className="mt-4 border-t border-border-soft pt-3">
          {!isRefusing ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApprove(booking.booking_pets_uuid)}
                className="rounded-lg bg-action-dark px-4 py-2 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark-hover disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsRefusing(true)}
                className="rounded-lg border border-status-danger px-4 py-2 type-meta font-semibold text-status-danger transition hover:bg-status-danger-soft disabled:opacity-50"
              >
                Refuse
              </button>
            </div>
          ) : (
            <RefuseForm
              releasesHold={openCard}
              isBusy={isBusy}
              onRefuse={(reason) => {
                onRefuse(booking.booking_pets_uuid, reason);
                setIsRefusing(false);
              }}
              onCancel={() => setIsRefusing(false)}
            />
          )}
        </div>
      )}

      {atDesk && (
        <ArrivalPanel
          booking={booking}
          petsOfBooking={petsOfBooking}
          showFinish={isFirstOfBooking}
          isBusy={isBusy}
          canTurnAway={!staffDesk}
          onRecordArrival={onRecordArrival}
          onFinishCheckIn={onFinishCheckIn}
        />
      )}

      {offerNoFeeCancel && !staffDesk && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <ExceptionReschedule
            bookingId={booking.booking_id}
            dropOffAt={info.drop_off_at}
            isBusy={isBusy}
            onMove={onRescheduleWithoutCharge}
          />
          <ExceptionCancel
            bookingId={booking.booking_id}
            isBusy={isBusy}
            onCancel={onCancelWithoutFee}
          />
        </div>
      )}

      {status === 'approved' && info.reviewer_name && (
        <p className="mt-3 type-meta text-notice-secondary">Approved by {info.reviewer_name}</p>
      )}

      {status === 'approved' && (
        <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-3">
          {/* A pet whose profile the parent deleted keeps its stay here, with no profile to open. */}
          {pet.id ? (
            <Link
              to={`/admin/pets/${pet.id}?bookingPetsUuid=${booking.booking_pets_uuid}`}
              className="rounded-lg bg-action-dark px-4 py-2 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark-hover"
            >
              View Profile
            </Link>
          ) : (
            <span className="type-meta text-notice-secondary">Profile deleted by the owner</span>
          )}
          {!staffDesk && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleUndoClick}
              className="rounded-lg border border-status-danger px-4 py-2 type-meta font-semibold text-status-danger transition hover:bg-status-danger-soft disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

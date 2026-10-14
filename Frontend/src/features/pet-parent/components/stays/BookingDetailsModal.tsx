import type { ReactElement, ReactNode } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { ManagerReasonText } from './ManagerReasonText';
import type { PetStay } from '../../types/stays';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { GetReadyTaskList } from '../get-ready/GetReadyTaskList';
import { getReadyProgress, getReadyTargetOf } from '../get-ready/getReadyTasks';
import { SECTION_EYEBROW, SECTION_TITLE } from '../home/homeStyles';
import { BoardingPass } from './BoardingPass';
import { formatDateTime } from './formatStayDate';
import { formatServiceLinePrice, formatStayAmount, serviceLineLabel } from './serviceLines';
import { StatusBadge } from './StatusBadge';
import { STAYS_COPY, type StaysCopy } from './staysCopy';
import { StayChangeLinks, type StayChangeHandlers } from './StayChangeLinks';
import { hasBoardingPass } from './stayStatus';
import { ParentNoteText } from '../ParentNoteText';
import { useParentWrittenText, type ParentNote } from '../../i18n/parentWrittenText';

/** Each change handler opens its dialog; one left out means the details offer no such change. */
interface BookingDetailsModalProps extends StayChangeHandlers {
  /** The stay to show. `null` keeps the modal closed. */
  stay: PetStay | null;
  onClose: () => void;
  now?: Date;
}

type DetailsCopy = StaysCopy['details'];

function yesNo(value: boolean | null, copy: DetailsCopy): string {
  if (value === null) return copy.notSpecified;
  return value ? copy.yes : copy.no;
}

/** The care answers the parent typed themselves, which may be in either language. */
function typedCareAnswers(stay: PetStay): string[] {
  const { caringInfo } = stay;
  return [
    caringInfo.feedingRoutine,
    caringInfo.medInstruction,
    caringInfo.behaveNHealth,
    caringInfo.others,
  ].filter(Boolean);
}

// Free-text care fields show what the parent typed, in the page's language; a field left blank
// when booking reads `blankCareField` instead.
function caringInfoRows(
  stay: PetStay,
  copy: DetailsCopy,
  shown: (note: string) => ParentNote,
): { label: string; value: ReactNode }[] {
  const { caringInfo } = stay;
  const typed = (value: string): ReactNode =>
    value ? <ParentNoteText note={shown(value)} /> : copy.blankCareField;
  return [
    { label: copy.feedingRoutine, value: typed(caringInfo.feedingRoutine) },
    { label: copy.medication, value: typed(caringInfo.medInstruction) },
    { label: copy.firstTimeBoarding, value: yesNo(caringInfo.firstTimeBoarding, copy) },
    { label: copy.crateTrained, value: yesNo(caringInfo.crateTrained, copy) },
    { label: copy.socialize, value: yesNo(caringInfo.socialAllow, copy) },
    { label: copy.fullyVaccinated, value: yesNo(caringInfo.fullyVaccinated, copy) },
    { label: copy.behaviourAndHealth, value: typed(caringInfo.behaveNHealth) },
    { label: copy.otherNotes, value: typed(caringInfo.others) },
  ];
}

/** One label and value line of the booking summary. The value wraps under a long label on a
 * phone rather than pushing the dialog wider. */
function SummaryRow({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={`flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3 ${className}`}>
      <dt className="type-meta">{label}</dt>
      <dd className="type-body m-0 text-right text-notice-primary">{children}</dd>
    </div>
  );
}

/** A request that is not approved: what was asked for, its status and, when refused, the reason.
 * It says "requested" and "reference", never "booked" or "confirmation", because nothing is
 * booked until our manager approves. */
function RequestSummary({ stay }: { stay: PetStay }): ReactElement {
  const locale = usePortalLocale();
  const { shared, details } = usePortalCopy(STAYS_COPY);
  return (
    <dl className="m-0 divide-y divide-border-soft rounded-xl border border-border-soft bg-surface-cream/50 px-4 sm:px-5">
      <SummaryRow label={shared.reference}>
        <span className="font-bold tabular-nums tracking-wide">{stay.confirmationNumber}</span>
      </SummaryRow>
      <SummaryRow label={shared.status}>
        <StatusBadge status={stay.status} />
      </SummaryRow>
      {stay.status === 'refused' && stay.refusalReason && (
        <SummaryRow label={details.managerSaid}>
          <ManagerReasonText reason={stay.refusalReason} sentence={(reason) => reason} />
        </SummaryRow>
      )}
      {stay.reviewerName && <SummaryRow label={details.reviewedBy}>{stay.reviewerName}</SummaryRow>}
      <SummaryRow label={details.requestedOn}>{formatDateTime(stay.createdAt, locale)}</SummaryRow>
      <SummaryRow label={shared.pet}>{stay.pet.name}</SummaryRow>
      <SummaryRow label={shared.dropOff}>{formatDateTime(stay.dropOffAt, locale)}</SummaryRow>
      <SummaryRow label={shared.pickUp}>{formatDateTime(stay.pickUpAt, locale)}</SummaryRow>
      {stay.services.map((service) => (
        <SummaryRow key={service.id} label={serviceLineLabel(service, locale)}>
          {formatServiceLinePrice(service.total, locale)}
        </SummaryRow>
      ))}
      <SummaryRow label={shared.total}>
        <span className="font-fraunces text-card-title font-bold">
          {formatStayAmount(stay.total)}
        </span>
      </SummaryRow>
    </dl>
  );
}

// One stay's details for My stays and Home. An approved stay (also while it runs and after it
// ends) leads with its boarding pass; any other request shows a plain summary instead. Before
// drop-off an approved stay's "Get ready" tasks follow the pass. The care information the parent
// gave comes last either way.
export function BookingDetailsModal({
  stay,
  onClose,
  now = new Date(),
  ...changeHandlers
}: BookingDetailsModalProps): ReactElement | null {
  const { shared, details } = usePortalCopy(STAYS_COPY);
  const locale = usePortalLocale();
  const shownNote = useParentWrittenText(stay ? typedCareAnswers(stay) : []);
  if (!stay) return null;

  return (
    <Modal isOpen onClose={onClose}>
      {/* Modal renders into <body>, outside the portal's `parent-type-scale` wrapper, so the
          dialog brings the customer type sizes with it. */}
      <div className="parent-type-scale">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-details-title"
          className="max-h-[85vh] overflow-y-auto p-5 sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="booking-details-title" className={SECTION_TITLE}>
              {details.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={shared.close}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-notice-muted transition-colors hover:bg-surface-deep hover:text-notice-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {hasBoardingPass(stay) ? <BoardingPass stay={stay} /> : <RequestSummary stay={stay} />}

          {/* The same change links the stay card offers, so a parent reading the details need
              not go back. */}
          <StayChangeLinks stay={stay} now={now} {...changeHandlers} />

          {stay.getReady && (
            <section className="mt-6" aria-labelledby="booking-get-ready-title">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 id="booking-get-ready-title" className={`${SECTION_EYEBROW} m-0`}>
                  {details.getReadyTitle}
                </h3>
                <p className="type-meta m-0 font-bold text-notice-primary">
                  {getReadyProgress(stay.getReady, locale)}
                </p>
              </div>
              <GetReadyTaskList tasks={stay.getReady} target={getReadyTargetOf(stay)} />
            </section>
          )}

          <section className="mt-6" aria-labelledby="booking-care-title">
            <h3 id="booking-care-title" className={`${SECTION_EYEBROW} m-0 mb-2`}>
              {details.careTitle}
            </h3>
            <dl className="m-0 grid grid-cols-1 gap-4 rounded-xl border border-border-soft bg-surface-cream/50 p-4 sm:grid-cols-2 sm:p-5">
              {caringInfoRows(stay, details, shownNote).map((row) => (
                <div key={row.label}>
                  <dt className={SECTION_EYEBROW}>{row.label}</dt>
                  <dd className="type-body m-0 mt-1 text-notice-secondary">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </Modal>
  );
}

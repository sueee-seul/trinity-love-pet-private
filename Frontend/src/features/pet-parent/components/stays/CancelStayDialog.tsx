import { useEffect, useState, type ReactElement } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { cancelStay, previewCancellation } from '../../api/stayChangesApi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { requestErrorText } from '../../i18n/requestErrorText';
import type { PetStay } from '../../types/stays';
import {
  CANCELLATION_FEE_CHANGED,
  type CancellationPreview,
  type CancellationResult,
  type TeamContactDetails,
} from '../../types/stayChanges';
import { STAY_CHANGES_COPY, type StayChangesCopy } from './stayChangesCopy';
import { StayDialogFrame } from './StayDialogFrame';
import {
  apiErrorCode,
  aucklandDateOf,
  changedAmountOf,
  formatDay,
  formatMoney,
  isPaid,
  listOfNames,
} from './stayChangeRules';

interface CancelStayDialogProps {
  stay: PetStay;
  /** Every pet on the booking: cancelling cancels them all. */
  petNames: string[];
  onClose: () => void;
  onCancelled: (result: CancellationResult) => void;
}

type CancelCopy = StayChangesCopy['cancel'];

// The error itself is kept, not its words, so the fallback is written in the language on screen.
type CostState =
  | { status: 'loading' }
  | { status: 'ready'; preview: CancellationPreview }
  | { status: 'error'; error: unknown };

const costText = (preview: CancellationPreview, copy: CancelCopy, paid: boolean): string => {
  // Paid at request, nothing is released: the fee is kept and the rest refunded.
  if (paid) {
    return preview.fee > 0 ? copy.costWithFeePaid(formatMoney(preview.fee)) : copy.freePaid;
  }
  if (preview.fee > 0) {
    return copy.costWithFee(formatMoney(preview.fee), preview.rule === 'short_notice');
  }
  if (preview.rule === 'approval_grace') return copy.freeApprovalGrace;
  if (preview.rule === 'pending_request') return copy.freePendingRequest;
  if (preview.rule === 'approval_time_unknown') return copy.freeApprovalTimeUnknown;
  return preview.rule === 'cooling_off' ? copy.freeCoolingOff : copy.freeEarly;
};

function TeamContact({ contact }: { contact: TeamContactDetails }): ReactElement {
  const copy = usePortalCopy(STAY_CHANGES_COPY).cancel;
  return (
    <p className="m-0 mt-3 type-meta text-notice-secondary">
      {copy.teamContact}
      {contact.email && (
        <>
          {' '}
          <a
            className="font-semibold text-notice-primary underline"
            href={`mailto:${contact.email}`}
          >
            {contact.email}
          </a>
        </>
      )}
      {contact.phone && (
        <>
          {' '}
          <a className="font-semibold text-notice-primary underline" href={`tel:${contact.phone}`}>
            {contact.phone}
          </a>
        </>
      )}
    </p>
  );
}

/** Says exactly what cancelling costs before the guest confirms; the server charges the same. */
export function CancelStayDialog({
  stay,
  petNames,
  onClose,
  onCancelled,
}: CancelStayDialogProps): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(STAY_CHANGES_COPY).cancel;
  const [cost, setCost] = useState<CostState>({ status: 'loading' });
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    previewCancellation(stay.bookingId)
      .then((preview) => {
        if (active) setCost({ status: 'ready', preview });
      })
      .catch((error: unknown) => {
        if (active) setCost({ status: 'error', error });
      });
    return (): void => {
      active = false;
    };
  }, [stay.bookingId]);

  // The button charges the fee it names: the server refuses any other amount, and the dialog then
  // shows the fee as it is now and asks again.
  const confirm = async (): Promise<void> => {
    if (cost.status !== 'ready') return;
    setSending(true);
    setProblem(null);
    try {
      onCancelled(await cancelStay(stay.bookingId, { expectedFee: cost.preview.fee }));
    } catch (error) {
      const newFee = changedAmountOf(error);
      if (apiErrorCode(error) === CANCELLATION_FEE_CHANGED && newFee !== null) {
        setCost({ status: 'ready', preview: { ...cost.preview, fee: newFee } });
        setProblem(copy.feeChanged);
      } else {
        setProblem(requestErrorText(error, locale, copy.cancelFailed, copy.refusals));
      }
    } finally {
      setSending(false);
    }
  };

  const fee = cost.status === 'ready' ? cost.preview.fee : 0;
  return (
    <Modal isOpen onClose={onClose}>
      <StayDialogFrame titleId="cancel-stay-title" title={copy.title} onClose={onClose}>
        <p className="m-0 type-body text-notice-secondary">
          {copy.intro(
            listOfNames(petNames, locale),
            formatDay(aucklandDateOf(stay.dropOffAt), locale),
          )}
        </p>
        {cost.status === 'loading' && (
          <p className="m-0 mt-3 type-meta text-notice-muted">{copy.working}</p>
        )}
        {cost.status === 'error' && (
          <p role="alert" className="m-0 mt-3 type-button text-status-danger">
            {requestErrorText(cost.error, locale, copy.costFailed, copy.refusals)}
          </p>
        )}
        {cost.status === 'ready' && (
          <>
            <p className="m-0 mt-3 type-body font-semibold leading-6 text-notice-primary">
              {costText(cost.preview, copy, isPaid(stay))}
            </p>
            <TeamContact contact={cost.preview.contact} />
          </>
        )}
        {problem && (
          <p role="alert" className="m-0 mt-3 type-button text-status-danger">
            {problem}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-soft px-4 py-2 type-button text-notice-primary hover:bg-surface-cream"
          >
            {copy.keepStay}
          </button>
          <button
            type="button"
            disabled={cost.status !== 'ready' || sending}
            onClick={() => void confirm()}
            className="rounded-full bg-status-danger px-4 py-2 type-button text-white disabled:opacity-50"
          >
            {fee > 0 ? copy.confirmWithFee(formatMoney(fee)) : copy.confirmFree}
          </button>
        </div>
      </StayDialogFrame>
    </Modal>
  );
}

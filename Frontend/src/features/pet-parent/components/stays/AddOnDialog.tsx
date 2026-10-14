import { useEffect, useState, type ReactElement } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal/Modal';
import { bookAddOn, fetchAddOnCatalogue } from '../../api/stayChangesApi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';
import {
  ADD_ON_PRICE_CHANGED,
  type AddOnCatalogue,
  type AddOnResult,
} from '../../types/stayChanges';
import { AddOnOfferList } from './AddOnOfferList';
import { IN_STAY_CHANGES_COPY } from './inStayChangesCopy';
import { StayDialogActions } from './StayDialogActions';
import { StayDialogFrame } from './StayDialogFrame';
import {
  apiErrorCode,
  changedAmountOf,
  formatDay,
  formatMoney,
  problemMessage,
} from './stayChangeRules';
import { DIALOG_ALERT, DIALOG_INPUT, DIALOG_INTRO, DIALOG_LABEL } from './stayDialogStyles';

interface AddOnDialogProps {
  stay: PetStay;
  onClose: () => void;
  onAdded: (result: AddOnResult) => void;
}

type CatalogueState =
  | { status: 'loading' }
  | { status: 'ready'; catalogue: AddOnCatalogue }
  | { status: 'error'; error: unknown };

const PER_DAY = 'per day';
const QUANTITIES = [1, 2, 3, 4, 5];

const cents = (amount: number): number => Math.round(amount * 100) / 100;

/** Books one priced service for one day of a stay under way, at the price the button names. */
export function AddOnDialog({ stay, onClose, onAdded }: AddOnDialogProps): ReactElement {
  const locale = usePortalLocale();
  const { addOn: copy, shared } = usePortalCopy(IN_STAY_CHANGES_COPY);
  const [catalogue, setCatalogue] = useState<CatalogueState>({ status: 'loading' });
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  // The amount the server now asks, after it refused the one the button named.
  const [newAmount, setNewAmount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAddOnCatalogue(stay.bookingId)
      .then((loaded) => {
        if (!active) return;
        setCatalogue({ status: 'ready', catalogue: loaded });
        setServiceId(loaded.offers[0]?.serviceId ?? '');
        setDate(loaded.days[0] ?? '');
      })
      .catch((error: unknown) => {
        if (active) setCatalogue({ status: 'error', error });
      });
    return (): void => {
      active = false;
    };
  }, [stay.bookingId]);

  const offers = catalogue.status === 'ready' ? catalogue.catalogue.offers : [];
  const days = catalogue.status === 'ready' ? catalogue.catalogue.days : [];
  const toBill = catalogue.status === 'ready' && catalogue.catalogue.settlement === 'desk';
  const offer = offers.find((candidate) => candidate.serviceId === serviceId) ?? null;
  const perDay = offer?.priceUnit === PER_DAY;
  const amount = newAmount ?? (offer ? cents(offer.price * quantity) : 0);

  // A different choice is a different price: the server's correction no longer applies.
  const choose = (next: () => void): void => {
    next();
    setNewAmount(null);
    setProblem(null);
  };
  const chooseOffer = (id: string): void =>
    choose(() => {
      setServiceId(id);
      // Only a per-day service is counted; anything else is one for the stay.
      if (offers.find((candidate) => candidate.serviceId === id)?.priceUnit !== PER_DAY) {
        setQuantity(1);
      }
    });

  const confirm = async (): Promise<void> => {
    if (!offer || date === '') return;
    setSending(true);
    setProblem(null);
    try {
      onAdded(
        await bookAddOn(stay.bookingId, stay.bookingPetId, {
          serviceId: offer.serviceId,
          date,
          quantity,
          expectedAmount: amount,
        }),
      );
    } catch (error) {
      const changed = changedAmountOf(error);
      if (apiErrorCode(error) === ADD_ON_PRICE_CHANGED && changed !== null) {
        setNewAmount(changed);
        setProblem(shared.amountChanged);
      } else {
        setProblem(problemMessage(error, copy.addFailed));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <StayDialogFrame titleId="add-on-title" title={copy.title} onClose={onClose}>
        <p className={DIALOG_INTRO}>{copy.intro(stay.pet.name)}</p>
        {catalogue.status === 'loading' && (
          <p className="m-0 mt-3 text-[13px] text-notice-muted">{copy.loading}</p>
        )}
        {catalogue.status === 'error' && (
          <p role="alert" className={DIALOG_ALERT}>
            {problemMessage(catalogue.error, copy.loadFailed)}
          </p>
        )}
        {catalogue.status === 'ready' && offers.length === 0 && (
          <p className="m-0 mt-3 text-[13px] text-notice-secondary">{copy.noOffers}</p>
        )}
        {offers.length > 0 && (
          <>
            <AddOnOfferList offers={offers} selectedId={serviceId} onSelect={chooseOffer} />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="add-on-day" className={DIALOG_LABEL}>
                  {copy.day}
                </label>
                <select
                  id="add-on-day"
                  value={date}
                  onChange={(event) => choose(() => setDate(event.target.value))}
                  className={DIALOG_INPUT}
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {formatDay(day, locale)}
                    </option>
                  ))}
                </select>
              </div>
              {perDay && (
                <div>
                  <label htmlFor="add-on-quantity" className={DIALOG_LABEL}>
                    {copy.quantity}
                  </label>
                  <select
                    id="add-on-quantity"
                    value={quantity}
                    onChange={(event) => choose(() => setQuantity(Number(event.target.value)))}
                    className={DIALOG_INPUT}
                  >
                    {QUANTITIES.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <p className="m-0 mt-3 text-[13px] text-notice-secondary">
              {toBill ? shared.addedToBill : shared.chargedNow}
            </p>
          </>
        )}
        {problem && (
          <p role="alert" className={DIALOG_ALERT}>
            {problem}
          </p>
        )}

        <StayDialogActions
          keepLabel={shared.keep}
          onKeep={onClose}
          actionLabel={offer ? copy.confirm(quantity, offer.name, formatMoney(amount)) : copy.title}
          onAction={() => void confirm()}
          actionDisabled={!offer || date === '' || sending}
        />
      </StayDialogFrame>
    </Modal>
  );
}

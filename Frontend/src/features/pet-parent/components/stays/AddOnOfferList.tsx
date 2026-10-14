import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { AddOnOffer } from '../../types/stayChanges';
import { IN_STAY_CHANGES_COPY } from './inStayChangesCopy';
import { formatMoney } from './stayChangeRules';
import { DIALOG_LABEL } from './stayDialogStyles';

interface AddOnOfferListProps {
  offers: AddOnOffer[];
  selectedId: string;
  onSelect: (serviceId: string) => void;
}

/** The add-ons a stay offers, one radio each, named with the price and what it is for. */
export function AddOnOfferList({
  offers,
  selectedId,
  onSelect,
}: AddOnOfferListProps): ReactElement {
  const copy = usePortalCopy(IN_STAY_CHANGES_COPY).addOn;
  return (
    <fieldset className="m-0 mt-4 border-0 p-0">
      <legend className={DIALOG_LABEL}>{copy.offer}</legend>
      <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
        {offers.map((offer) => (
          <li key={offer.serviceId}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft px-3 py-2.5 text-[13px] leading-5 has-checked:border-action-dark">
              <input
                type="radio"
                name="add-on-offer"
                value={offer.serviceId}
                checked={offer.serviceId === selectedId}
                onChange={() => onSelect(offer.serviceId)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-notice-primary">
                  {offer.name}, {formatMoney(offer.price)} {copy.unit(offer.priceUnit)}
                </span>
                {offer.description && (
                  <span className="block text-notice-secondary">{offer.description}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

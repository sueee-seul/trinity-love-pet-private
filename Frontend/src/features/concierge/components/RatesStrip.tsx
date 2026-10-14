import React, { useId, useState } from 'react';
import type { Service } from '../../pet-parent/types/booking';
import { conciergeApi } from '../api/conciergeApi';
import type { ConciergeCopy } from '../copy';
import { useConciergeLocale } from '../hooks/useConciergeLocale';
import { useConciergeRates } from '../hooks/useConciergeStatus';
import { serviceNameText } from '../utils/serviceNames';
import { formatNzd, priceUnitLabel } from '../utils/format';
import { rateCardGroups } from '../utils/rateCard';
import { HERO_BAND_INLINE_TEXT_BUTTON, INLINE_TEXT_BUTTON } from './conciergeStyles';

/**
 * A real price before any question, the way Rover, Pawshake and NZ kennels show one. The "from"
 * figure is the server's Essential total for one pet and one night (cheapest room and food plus
 * anything compulsory), so it is a stay a guest can actually book, never a bait price. The full
 * rate card is one tap away and read-only.
 */
interface RatesStripProps {
  copy: ConciergeCopy;
  /**
   * The line sits straight on the /book hero band, so it takes the band's ink. The rate card it
   * opens is an opaque card either way and keeps the normal text tokens.
   */
  onHeroBand: boolean;
}

export const RatesStrip: React.FC<RatesStripProps> = ({ copy, onHeroBand }) => {
  const rates = useConciergeRates();
  const { locale } = useConciergeLocale();
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<Service[] | null>(null);
  const panelId = useId();

  if (!rates) return null;

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && catalogue === null) {
      conciergeApi
        .catalogue()
        .then(setCatalogue)
        .catch(() => setCatalogue([]));
    }
  };

  const groups = catalogue ? rateCardGroups(copy, catalogue) : [];

  return (
    <div className="flex flex-col gap-1">
      <p
        className={`m-0 type-body font-semibold ${onHeroBand ? 'text-hero-ink' : 'text-notice-primary'}`}
      >
        {copy.rates.fromLine(formatNzd(rates.fromTotal))}{' '}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={`${onHeroBand ? HERO_BAND_INLINE_TEXT_BUTTON : INLINE_TEXT_BUTTON} text-body`}
        >
          {open ? copy.rates.hideAll : copy.rates.showAll}
        </button>
      </p>
      {open && (
        <div
          id={panelId}
          // On the band the card shares the text column, under half the page from 768px, where
          // three columns would squeeze each name against its price.
          className={`mt-2 grid max-w-3xl grid-cols-1 gap-4 rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card ${onHeroBand ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
        >
          {groups.map((group) => (
            <div key={group.title} className="min-w-0">
              <h2 className="m-0 type-eyebrow tracking-[0.16em] text-notice-muted">
                {group.title}
              </h2>
              <dl className="m-0 mt-2 flex flex-col gap-2">
                {group.items.map((service) => (
                  <div key={service.id} className="flex items-baseline justify-between gap-3">
                    <dt className="m-0 min-w-0 type-meta text-notice-primary [overflow-wrap:anywhere]">
                      {serviceNameText(service.name, locale)}
                    </dt>
                    <dd className="m-0 flex-shrink-0 text-right type-meta tabular-nums text-notice-primary">
                      {formatNzd(service.price)}
                      <span className="block text-notice-muted">
                        {priceUnitLabel(copy, service.priceUnit)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

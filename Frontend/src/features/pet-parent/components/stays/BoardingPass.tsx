import type { ReactElement, ReactNode } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { ApprovedPetStay } from '../../types/stays';
import { SECTION_EYEBROW } from '../home/homeStyles';
import { formatDateRange, formatTime } from './formatStayDate';
import { formatServiceLinePrice, formatStayAmount, serviceLineLabel } from './serviceLines';
import { StatusBadge } from './StatusBadge';
import { STAYS_COPY } from './staysCopy';

function PassRow({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <dt className={SECTION_EYEBROW}>{label}</dt>
      <dd className="type-body m-0 mt-1 font-semibold text-notice-primary [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/**
 * The boarding pass (住宿凭证 on the Chinese booking page): the record of a stay our manager
 * approved. The contract forms when that approval reaches the parent, so the pass exists only from
 * then on, and its type accepts nothing else: a request still waiting, refused or cancelled is not
 * a booking (see `hasBoardingPass`). The booking page shows a plain request receipt instead.
 */
export function BoardingPass({ stay }: { stay: ApprovedPetStay }): ReactElement {
  const locale = usePortalLocale();
  const { shared, boardingPass } = usePortalCopy(STAYS_COPY);
  const titleId = `boarding-pass-${stay.bookingPetId}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="relative overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card print:break-inside-avoid print:shadow-none"
    >
      <div className="flex items-baseline justify-between gap-3 bg-action-dark px-5 py-4 text-on-action-dark">
        <h3 id={titleId} className="type-eyebrow m-0 tracking-[0.22em] text-on-action-dark">
          {boardingPass.title}
        </h3>
        {/*
         * The monogram is the header text at reduced strength, so it recedes behind the title yet
         * still shows on every theme's fill (4.8:1 at worst, on Moonlight). The hero ink is not
         * used here because on most themes it is the fill colour itself, or close to it.
         */}
        <span aria-hidden="true" className="font-agbalumo text-body text-on-action-dark/75">
          WAG
        </span>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-4 px-5 pb-5 pt-4">
        <PassRow label={shared.reference} wide>
          <span className="font-fraunces text-card-title font-bold tabular-nums">
            {stay.confirmationNumber}
          </span>
        </PassRow>
        <PassRow label={shared.status} wide>
          <StatusBadge status={stay.status} />
        </PassRow>
        <PassRow label={shared.pet} wide>
          {stay.pet.name}
        </PassRow>
        <PassRow label={boardingPass.dates} wide>
          {formatDateRange(stay.dropOffAt, stay.pickUpAt, locale)} · {shared.nights(stay.nights)}
        </PassRow>
        <PassRow label={shared.dropOff}>{formatTime(stay.dropOffAt, locale)}</PassRow>
        <PassRow label={shared.pickUp}>{formatTime(stay.pickUpAt, locale)}</PassRow>
        {stay.services.length > 0 && (
          <PassRow label={boardingPass.services} wide>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {stay.services.map((service) => (
                <li key={service.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>{serviceLineLabel(service, locale)}</span>
                  <span className="tabular-nums">
                    {formatServiceLinePrice(service.total, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </PassRow>
        )}
      </dl>

      {/* The tear line: two notches and a dashed rule, like a real pass. */}
      <div aria-hidden="true" className="relative h-5">
        <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full border border-border-soft bg-surface-cream" />
        <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full border border-border-soft bg-surface-cream" />
        <span className="absolute inset-x-5 top-1/2 border-t border-dashed border-border-soft" />
      </div>

      <dl className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-5 pt-3">
        <dt className={SECTION_EYEBROW}>{shared.total}</dt>
        <dd className="m-0 font-fraunces text-display font-bold leading-none tabular-nums text-notice-primary">
          {formatStayAmount(stay.total)}
        </dd>
      </dl>
    </section>
  );
}

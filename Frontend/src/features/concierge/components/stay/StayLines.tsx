import React from 'react';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeLocale, ConciergeQuoteLine } from '../../types';
import { formatNzd, priceUnitLabel } from '../../utils/format';
import { serviceNameText } from '../../utils/serviceNames';

interface StayLinesProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  lines: ConciergeQuoteLine[];
  /** The pets' names by position, for the heading over each pet's lines. */
  petNames: ReadonlyArray<string | undefined>;
}

/**
 * The full breakdown of a priced stay, pet by pet: each service with its unit price and what it
 * comes to over the stay. Every number is the server's; nothing is added up here.
 */
export const StayLines: React.FC<StayLinesProps> = ({ copy, locale, lines, petNames }) => {
  const petIndexes = Array.from(new Set(lines.map((line) => line.petIndex)));
  return (
    <div className="flex flex-col gap-3">
      {petIndexes.map((petIndex) => (
        <div key={petIndex}>
          {petIndexes.length > 1 && (
            <p className="m-0 mb-1 type-eyebrow tracking-[0.14em] text-notice-muted">
              {petNames[petIndex] ?? copy.packages.forPet(petIndex)}
            </p>
          )}
          <dl className="m-0 flex flex-col gap-1.5">
            {lines
              .filter((line) => line.petIndex === petIndex)
              .map((line) => (
                <div
                  key={`${line.petIndex}-${line.serviceId}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="m-0 min-w-0 type-meta text-notice-primary [overflow-wrap:anywhere]">
                    {serviceNameText(line.name, locale)}
                    <span className="block text-notice-muted">
                      {formatNzd(line.unitPrice)} {priceUnitLabel(copy, line.priceUnit)}
                    </span>
                  </dt>
                  <dd className="m-0 flex-shrink-0 type-meta font-semibold tabular-nums text-notice-primary">
                    {formatNzd(line.lineTotal)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
    </div>
  );
};

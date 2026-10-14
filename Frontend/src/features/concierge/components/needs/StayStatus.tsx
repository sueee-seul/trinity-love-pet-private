import React from 'react';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeNeedField, ConciergeNeeds } from '../../types';
import { dateProblem, todayInNewZealand } from '../../utils/format';

interface StayStatusProps {
  copy: ConciergeCopy;
  needs: ConciergeNeeds;
  missingFields: ConciergeNeedField[];
}

/**
 * One line that says whether the stay can be priced yet, and if not, what is missing or why the
 * dates cannot be quoted. It sits at the top of the stay card and stays visible while the card is
 * folded on a phone. Each state has a symbol and words, never colour alone.
 */
export const StayStatus: React.FC<StayStatusProps> = ({ copy, needs, missingFields }) => {
  const { stay } = copy;
  const problem = dateProblem(needs.startDate, needs.endDate, todayInNewZealand());
  const ready = missingFields.length === 0;
  const unsizedDog = needs.pets.some((pet) => pet.species === 'dog' && pet.size === null);
  const stillNeeded = missingFields
    // A date problem is explained in its own words above instead of a bare "dates".
    .filter((field) => !(field === 'dates' && problem))
    .map((field) => copy.missing[field]);

  return (
    <div
      role="status"
      className={`mt-3 flex flex-col gap-1 rounded-2xl px-3 py-2.5 ${
        ready ? 'bg-status-success/10' : 'bg-surface-cream'
      }`}
    >
      {problem && (
        <p className="m-0 flex items-start gap-2 type-meta font-semibold text-status-danger">
          <span aria-hidden="true">!</span>
          <span>{stay.dateProblem[problem]}</span>
        </p>
      )}
      {(ready || stillNeeded.length > 0) && (
        <p
          className={`m-0 flex items-start gap-2 type-meta font-semibold ${
            ready ? 'text-status-success' : 'text-notice-secondary'
          }`}
        >
          <span aria-hidden="true">{ready ? '✓' : '•'}</span>
          <span>
            {ready ? stay.ready : `${stay.stillNeeded}: ${stillNeeded.join(copy.listJoiner)}`}
          </span>
        </p>
      )}
      {unsizedDog && ready && (
        <p className="m-0 type-meta text-notice-secondary">{stay.sizeHint}</p>
      )}
    </div>
  );
};

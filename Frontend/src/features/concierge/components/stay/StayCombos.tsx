import React from 'react';
import { ConciergeIllustration as Illustration } from '../ConciergeIllustration';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeCombo, ConciergeLocale } from '../../types';
import { formatNzd, gstIncluded } from '../../utils/format';
import { serviceNameText } from '../../utils/serviceNames';
import { stayNameText } from '../../utils/stayName';
import { SECONDARY_BUTTON } from '../conciergeStyles';

interface StayCombosProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  combos: ConciergeCombo[];
  /** The combo the stay is taken from, unchanged; null once the guest edits a line. */
  appliedComboId: string | null;
  petNames: ReadonlyArray<string | undefined>;
  onUse: (comboId: string) => void;
}

/** What each pet gets, as the card lists it: one list when every pet has the same. */
const includesByPet = (
  combo: ConciergeCombo,
  petNames: ReadonlyArray<string | undefined>,
  copy: ConciergeCopy,
  locale: ConciergeLocale,
): Array<{ label: string | null; names: string[] }> => {
  const petIndexes = Array.from(new Set(combo.quote.lines.map((line) => line.petIndex)));
  const perPet = petIndexes.map((petIndex) => ({
    label: petNames[petIndex] ?? copy.packages.forPet(petIndex),
    names: combo.quote.lines
      .filter((line) => line.petIndex === petIndex)
      .map((line) => serviceNameText(line.name, locale)),
  }));
  const first = perPet[0];
  const allSame =
    first !== undefined && perPet.every((pet) => pet.names.join('|') === first.names.join('|'));
  return allSame ? [{ label: null, names: first.names }] : perPet;
};

/**
 * The two or three suggested stays. They are advice: one is marked as the assistant's pick with
 * the reason in words, and any of them can be taken as it is with one press. Every price is the
 * server's signed quote for exactly those lines.
 */
export const StayCombos: React.FC<StayCombosProps> = ({
  copy,
  locale,
  combos,
  appliedComboId,
  petNames,
  onUse,
}) => (
  // Side by side once the panel is wide enough, so every suggestion shows without scrolling.
  <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 @xl:grid-cols-2 @3xl:grid-cols-3">
    {combos.map((combo, order) => {
      const inUse = combo.id === appliedComboId;
      return (
        <li
          key={combo.id}
          aria-current={inUse ? 'true' : undefined}
          className={`concierge-rise theme-key-card flex flex-col rounded-2xl border bg-surface-card p-4 transition-[border-color,box-shadow] duration-200 ${
            inUse ? 'border-action-dark shadow-card ring-1 ring-action-dark' : 'border-border-soft'
          }`}
          style={{ '--concierge-rise-delay': `${order * 90}ms` } as React.CSSProperties}
        >
          <Illustration
            name="quiet-rest"
            className="mb-3"
            imageClassName="h-24 w-full rounded-xl object-cover @xl:h-20"
          />
          {combo.recommended && (
            <span className="mb-2 inline-flex w-fit items-center rounded-full border border-action-dark/40 bg-theme-peach px-2.5 py-0.5 type-meta font-semibold text-accent-foreground">
              {copy.packages.recommended}
            </span>
          )}
          <h4 className="m-0 type-body font-semibold text-notice-primary [overflow-wrap:anywhere]">
            {stayNameText(combo.quote.lines, petNames, copy, locale)}
          </h4>
          <p className="mb-0 mt-1 type-meta text-notice-secondary">{combo.reason}</p>
          <div className="mt-3 flex flex-col gap-2">
            {includesByPet(combo, petNames, copy, locale).map((pet, index) => (
              <div key={pet.label ?? index}>
                {pet.label && (
                  <p className="m-0 type-eyebrow tracking-[0.14em] text-notice-muted">
                    {pet.label}
                  </p>
                )}
                <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                  {pet.names.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-1 type-meta text-notice-secondary"
                    >
                      <span aria-hidden="true" className="text-status-success">
                        ✓
                      </span>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
            <div>
              <span className="block font-fraunces text-card-title font-bold leading-none tabular-nums text-notice-primary">
                {formatNzd(combo.quote.total)}
              </span>
              <span className="mt-1 block type-meta">
                {copy.packages.includesGst(formatNzd(gstIncluded(combo.quote.total)))} ·{' '}
                {copy.stay.nights(combo.quote.nights)}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={inUse}
              onClick={() => onUse(combo.id)}
              className={`${SECONDARY_BUTTON} min-h-11 px-4 aria-pressed:border-action-dark aria-pressed:bg-action-dark aria-pressed:text-on-action-dark`}
            >
              {inUse ? copy.packages.comboInUse : copy.packages.useCombo}
            </button>
          </div>
        </li>
      );
    })}
  </ul>
);

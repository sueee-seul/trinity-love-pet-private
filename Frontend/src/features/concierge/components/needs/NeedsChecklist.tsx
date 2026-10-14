import React, { useId } from 'react';
import { DateField } from '../../../../shared/components/ui/date';
import type { ConciergeCopy } from '../../copy';
import { selectAssistantThinking, useConciergeStore } from '../../store/conciergeStore';
import {
  CONCIERGE_MAX_PETS,
  type ConciergePetNeed,
  type ConciergePetSize,
  type ConciergeSpecies,
} from '../../types';
import { addDays, nightsBetween, todayInNewZealand } from '../../utils/format';
import { withDates, withPet, withPetCount } from '../../utils/needsEdit';
import { stayAtAGlance } from '../../utils/planSummary';
import {
  CARD_TITLE,
  CHECKBOX,
  CHECK_ROW,
  EYEBROW,
  FIELD_BOX,
  FIELD_LABEL,
  SURFACE_CARD,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { StayStatus } from './StayStatus';

/**
 * "Your stay": the running summary of the plan, and the tick-box way to say the same things as
 * the chat. Its status line always says what is still missing. Every change goes into the shared
 * needs straight away and the store refreshes the suggested stays a moment later, batching a run
 * of ticks into one request. Add-ons are not here: they are ticked in the stay panel, next to the
 * prices they change.
 *
 * On phones it starts folded right after the chat. Folded, it still shows the stay in one line
 * (dates, nights, pets) and the status line, so it keeps working as a running summary. It unfolds
 * itself when the assistant is down or the guest asks for it, so the reliable path is never hidden
 * when it is needed.
 */

const SPECIES: ConciergeSpecies[] = ['dog', 'cat', 'other'];
const SIZES: ConciergePetSize[] = ['small', 'medium', 'large'];
const PET_COUNTS = Array.from({ length: CONCIERGE_MAX_PETS }, (_unused, index) => index + 1);

/** Segmented choice built from native radios, so arrow keys and screen readers just work. */
export const ChoiceGroup = <T extends string>({
  legend,
  name,
  options,
  value,
  labelFor,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | null;
  labelFor: (option: T) => string;
  onChange: (option: T) => void;
}): React.ReactElement => (
  <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className={FIELD_LABEL}>{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option}
          className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-border-soft bg-surface-card px-4 type-meta font-semibold text-notice-primary transition-colors has-[:checked]:border-action-dark has-[:checked]:bg-action-dark has-[:checked]:text-on-action-dark has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {labelFor(option)}
        </label>
      ))}
    </div>
  </fieldset>
);

const PetFields: React.FC<{
  copy: ConciergeCopy;
  pet: ConciergePetNeed;
  index: number;
  onChange: (change: Partial<ConciergePetNeed>) => void;
}> = ({ copy, pet, index, onChange }) => {
  const groupName = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-2xl border border-border-soft p-4">
      <legend className="px-1 type-body font-semibold text-notice-primary">
        {copy.checklist.petLabel(index)}
        {pet.name ? ` · ${pet.name}` : ''}
      </legend>
      <ChoiceGroup
        legend={copy.checklist.species}
        name={`${groupName}-species`}
        options={SPECIES}
        value={pet.species}
        labelFor={(option) => copy.checklist[option]}
        onChange={(species) => onChange({ species, size: species === 'dog' ? pet.size : null })}
      />
      {pet.species === 'dog' && (
        <ChoiceGroup
          legend={copy.checklist.size}
          name={`${groupName}-size`}
          options={SIZES}
          value={pet.size}
          labelFor={(option) => copy.checklist[option]}
          onChange={(size) => onChange({ size })}
        />
      )}
      <div className="flex flex-col">
        <label className={CHECK_ROW}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={pet.needsMedication === true}
            onChange={(event) => onChange({ needsMedication: event.target.checked })}
          />
          {copy.checklist.medication}
        </label>
        <label className={CHECK_ROW}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={pet.firstTimeBoarding === true}
            onChange={(event) => onChange({ firstTimeBoarding: event.target.checked })}
          />
          {copy.checklist.firstStay}
        </label>
      </div>
    </fieldset>
  );
};

interface NeedsChecklistProps {
  copy: ConciergeCopy;
  /** Placement from the page: grid area, order and the sticky behaviour beside the chat. */
  className?: string;
}

export const NeedsChecklist: React.FC<NeedsChecklistProps> = ({ copy, className = '' }) => {
  const needs = useConciergeStore((state) => state.needs);
  const missingFields = useConciergeStore((state) => state.missingFields);
  const updateNeeds = useConciergeStore((state) => state.updateNeeds);
  const open = useConciergeStore((state) => state.checklistOpen);
  const setOpen = useConciergeStore((state) => state.setChecklistOpen);
  const thinking = useConciergeStore(selectAssistantThinking);
  const locale = useConciergeStore((state) => state.locale);
  const panelId = useId();
  const startId = useId();
  const endId = useId();
  const today = todayInNewZealand();
  const glance = stayAtAGlance(copy, locale, needs);

  const changeStart = (next: string): void =>
    updateNeeds((current) => {
      const { startDate, endDate } = current;
      if (!next) return withDates(current, null, endDate);
      // Moving the drop-off keeps the same number of nights, and pick-up never lands before it.
      const keepNights = startDate && endDate && endDate > startDate;
      const nextEnd = keepNights
        ? addDays(next, nightsBetween(startDate, endDate))
        : endDate && endDate > next
          ? endDate
          : addDays(next, 1);
      return withDates(current, next, nextEnd);
    });

  return (
    <section
      id="concierge-checklist"
      aria-labelledby={`${panelId}-title`}
      className={`${SURFACE_CARD} scroll-mt-4 p-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${panelId}-title`} className={CARD_TITLE}>
          {copy.checklist.title}
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={`${TEXT_BUTTON} lg:hidden`}
        >
          {open ? copy.checklist.toggleClose : copy.checklist.toggleOpen}
        </button>
      </div>
      {/* From lg up the fields always show, so the one-line summary is for the folded card only. */}
      {glance && !open && (
        <p className="m-0 mt-1 type-meta text-notice-secondary lg:hidden">{glance}</p>
      )}
      <StayStatus copy={copy} needs={needs} missingFields={missingFields} />

      {/* Paused while the assistant replies, so a tick never races the details it is reading. */}
      <fieldset
        id={panelId}
        disabled={thinking}
        className={`${open ? 'flex' : 'hidden'} m-0 mt-4 min-w-0 flex-col gap-5 border-0 p-0 disabled:opacity-70 lg:flex`}
      >
        <p className="m-0 type-meta text-notice-secondary">{copy.checklist.hint}</p>

        {/* Two columns only while the card is full width; beside the chat it is too narrow. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="min-w-0">
            <label htmlFor={startId} className={FIELD_LABEL}>
              {copy.checklist.startDate}
            </label>
            <DateField
              id={startId}
              locale={locale}
              min={today}
              value={needs.startDate ?? ''}
              onChange={changeStart}
              dialogLabel={copy.checklist.startDate}
              className={FIELD_BOX}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={endId} className={FIELD_LABEL}>
              {copy.checklist.endDate}
            </label>
            <DateField
              id={endId}
              locale={locale}
              min={addDays(needs.startDate ?? today, 1)}
              // With no pick-up yet, open on the drop-off month rather than today's.
              defaultMonth={needs.startDate ?? undefined}
              value={needs.endDate ?? ''}
              onChange={(value) =>
                updateNeeds((current) => withDates(current, current.startDate, value || null))
              }
              dialogLabel={copy.checklist.endDate}
              className={FIELD_BOX}
            />
          </div>
        </div>

        <ChoiceGroup
          legend={copy.checklist.petCount}
          name={`${panelId}-count`}
          options={PET_COUNTS.map(String)}
          value={needs.pets.length > 0 ? String(needs.pets.length) : null}
          labelFor={(option) => option}
          onChange={(option) => updateNeeds((current) => withPetCount(current, Number(option)))}
        />

        {needs.pets.map((pet, index) => (
          <PetFields
            // Pets have no id until checkout; position is their identity in the conversation.
            // eslint-disable-next-line react/no-array-index-key -- pets have no id before checkout and are only added or removed at the end, so position is their identity.
            key={`pet-${index}`}
            copy={copy}
            pet={pet}
            index={index}
            onChange={(change) => updateNeeds((current) => withPet(current, index, change))}
          />
        ))}

        {needs.notes.trim() && (
          // What the assistant noted for staff, so the guest can see it was understood. It is
          // edited on the details step, where it becomes part of the request.
          <div className="min-w-0">
            <p className={EYEBROW}>{copy.stay.notes}</p>
            <p className="m-0 mt-1 whitespace-pre-wrap type-meta text-notice-primary [overflow-wrap:anywhere]">
              {needs.notes}
            </p>
          </div>
        )}
      </fieldset>
    </section>
  );
};

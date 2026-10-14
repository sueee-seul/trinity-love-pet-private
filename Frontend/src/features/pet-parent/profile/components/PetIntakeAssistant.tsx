import React, { useId, useState } from 'react';
import {
  readPetDescription,
  type PetIntakeDraft,
  type PetIntakeMedication,
  type PetIntakeReadBack,
  type PetIntakeResult,
} from '../petIntakeApi';
import { DictationButton, useDictation } from '../../../../shared/dictation';
import { usePortalCopy, usePortalLocale, type PortalLocale } from '../../i18n/portalLocale';
import { PET_FORM_COPY } from '../copy/petFormCopy';
import type { Species } from '../types';
import { speciesLabel } from '../utils';
import {
  INTAKE_COPY,
  INTAKE_READ_FAILED,
  localizeIntakeError,
  localizeLanguageName,
  type IntakeCopy,
} from '../copy/intakeCopy';

/**
 * Describe the animal (typed or spoken, in any language) and the form fills itself in.
 *
 * The intake form asks for seventeen things, and a long form is where people give up. That is the
 * whole problem the "compulsory fields" work is up against. This lets an owner say it the way they
 * would say it out loud, in the language they actually think in.
 *
 * Three rules shape everything below:
 *
 * 1. **Nothing reaches the form until the owner says so.** Reading produces a draft that is shown
 *    back and goes no further. `onDraft` only fires on the confirm press. This is the owner's own
 *    record of their animal; a model writing it unattended is not something to ship.
 * 2. **Anything medical is confirmed separately.** Allergies and medications get their own gate,
 *    because they are the two fields where a mistranslation or a misheard word could actually hurt
 *    the animal. Everything else is a typo.
 * 3. **A translation says it translated.** When the owner wrote in Chinese and the form fills in
 *    English, the panel says so. A form that quietly rewrote someone's words in a language they
 *    cannot check is worse than one that did not try.
 */

/** Names the fields in the words the form uses, so what was understood can be checked at a glance. */
const fieldLabel = (key: string, copy: IntakeCopy): string =>
  key in copy.fieldLabels ? copy.fieldLabels[key as keyof PetIntakeDraft] : key;

/**
 * The two fields that get their own confirmation.
 *
 * `dietNotes` is deliberately not here. It is usually a preference rather than a restriction, and a
 * gate that trips on "likes kibble" teaches people to tick it without reading, which is exactly
 * what this gate exists to prevent. An allergy stated as a diet note also lands in `allergies`.
 */
const MEDICAL_FIELDS = ['allergies', 'medications'] as const;

/**
 * The server's floor (MIN_INTAKE_LENGTH). Two characters, not ten: "体重是30千克" is a whole fact in
 * seven, and an English-sized minimum left the button greyed out with no reason given.
 */
const MIN_DESCRIPTION_LENGTH = 2;

const describeMedication = (
  medication: PetIntakeMedication,
  copy: IntakeCopy,
  instructionsToRead: string | null | undefined,
): string => {
  const amount = [medication.dose, medication.unit].filter(Boolean).join(' ');
  const parts = [
    medication.name,
    medication.strength,
    amount || null,
    medication.schedule?.length ? medication.schedule.join(copy.scheduleJoiner) : null,
    medication.withFood === true ? copy.withFood : null,
    medication.withFood === false ? copy.withoutFood : null,
    instructionsToRead ?? medication.instructions,
  ].filter(Boolean);

  return parts.join(' · ');
};

/** A free-text field read back in the owner's language, when the server sent one. */
const readBackOf = (key: string, readBack: PetIntakeReadBack | null): string | string[] | null => {
  if (!readBack) return null;
  if (key === 'breed' || key === 'colour' || key === 'dietNotes' || key === 'behaviourNotes') {
    return readBack[key];
  }
  return key === 'allergies' ? readBack.allergies : null;
};

const describeValue = (
  key: string,
  value: unknown,
  copy: IntakeCopy,
  locale: PortalLocale,
  readBack: PetIntakeReadBack | null,
): string => {
  // The form stays English for staff; the owner checks the values in the language they read.
  const inReaderLanguage = readBackOf(key, readBack);
  if (inReaderLanguage) {
    return Array.isArray(inReaderLanguage)
      ? inReaderLanguage.join(copy.listSeparator)
      : inReaderLanguage;
  }
  // The draft keeps the form's own values ('DOG', 'male'); the reader sees the form's words.
  if (key === 'species' && typeof value === 'string') {
    return speciesLabel(value as Species, locale);
  }
  if (key === 'sex') {
    const option = PET_FORM_COPY[locale].sexOptions.find((sex) => sex.value === value);
    if (option) return option.label;
  }
  if (key === 'medications' && Array.isArray(value)) {
    return (value as PetIntakeMedication[])
      .map((medication, index) =>
        describeMedication(medication, copy, readBack?.medicationInstructions?.[index]),
      )
      .join(locale === 'zh' ? '；' : '; ');
  }
  if (Array.isArray(value)) {
    return value.join(copy.listSeparator);
  }
  if (typeof value === 'boolean') {
    return value ? copy.yes : copy.no;
  }
  return String(value);
};

const isMedicalField = (key: string): boolean =>
  MEDICAL_FIELDS.includes(key as (typeof MEDICAL_FIELDS)[number]);

interface PetIntakeAssistantProps {
  onDraft: (draft: PetIntakeDraft) => void;
}

export const PetIntakeAssistant: React.FC<PetIntakeAssistantProps> = ({ onDraft }) => {
  const locale = usePortalLocale();
  const copy = usePortalCopy(INTAKE_COPY);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'reading' | 'review' | 'filled' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PetIntakeResult | null>(null);
  const [isMedicalConfirmed, setIsMedicalConfirmed] = useState(false);

  // The section and the box inside it must not share a name, or a screen reader announces
  // "Describe your pet" twice with nothing to tell them apart.
  const headingId = useId();
  const medicalCheckboxId = useId();

  // Dictation writes into the same box the owner can type in, so speaking and typing are the same
  // input rather than two modes to choose between. `displayText` carries the interim transcript so
  // words appear as they are said.
  const {
    status: dictationStatus,
    displayText,
    error: dictationError,
    toggle: toggleDictation,
  } = useDictation({
    value: description,
    onChange: setDescription,
    messages: copy.dictationMessages,
  });
  const isListening = dictationStatus === 'listening';
  const isTranscribing = dictationStatus === 'finishing' || dictationStatus === 'requesting';

  const isBusy = status === 'reading' || isListening || isTranscribing;

  const read = async (): Promise<void> => {
    setStatus('reading');
    setError(null);
    setIsMedicalConfirmed(false);

    try {
      const next = await readPetDescription(description.trim());

      // Deliberately not calling onDraft here. The owner confirms first.
      setResult(next);
      setStatus('review');
    } catch (cause) {
      // The form still works by hand, so this is a convenience that failed, not a lost save.
      setError(cause instanceof Error ? cause.message : INTAKE_READ_FAILED);
      setResult(null);
      setStatus('failed');
    }
  };

  const draft = result?.draft ?? null;
  const readBack = result?.readBack ?? null;
  const filledFields = draft ? Object.keys(draft) : [];
  const medicalFields = filledFields.filter(isMedicalField);
  const ordinaryFields = filledFields.filter((key) => !isMedicalField(key));
  const needsMedicalConfirmation = medicalFields.length > 0;
  const canConfirm = filledFields.length > 0 && (!needsMedicalConfirmation || isMedicalConfirmed);

  const confirm = (): void => {
    if (!draft || !canConfirm) {
      return;
    }
    onDraft(draft);
    setStatus('filled');
  };

  const discard = (): void => {
    setResult(null);
    setIsMedicalConfirmed(false);
    setStatus('idle');
  };

  const wasTranslated = Boolean(
    result?.sourceLanguage && result.sourceLanguage.toLowerCase() !== 'english',
  );

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border-soft bg-surface-cream/40 p-4"
    >
      <p id={headingId} className="type-body font-semibold">
        {copy.heading}
      </p>
      <p className="mt-1 mb-0 type-meta">
        {copy.introBefore}
        <strong>{copy.introStrong}</strong>
        {copy.introAfter}
      </p>

      <div className="mt-3 flex items-start gap-3">
        <textarea
          value={displayText}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isBusy}
          rows={3}
          maxLength={4000}
          placeholder={copy.placeholder}
          aria-label={copy.boxLabel}
          className="min-w-0 flex-1 rounded-xl border border-control-border/50 bg-surface-card p-3 type-body text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        />
        <DictationButton
          status={dictationStatus}
          onToggle={toggleDictation}
          disabled={status === 'reading'}
          labels={copy.dictationLabels}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void read()}
          disabled={description.trim().length < MIN_DESCRIPTION_LENGTH || isBusy}
          className="min-h-11 rounded-xl bg-theme-sun px-4 type-button text-on-sun transition-colors hover:bg-theme-sun-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        >
          {status === 'reading' ? copy.reading : copy.read}
        </button>

        {/*
         * Announced, not just drawn. The panel below appears underneath the owner, and someone
         * using a screen reader has no other way to know what happened.
         */}
        <p aria-live="polite" className="m-0 type-meta text-notice-secondary">
          {isListening && copy.listening}
          {isTranscribing && copy.transcribing}
          {status === 'review' &&
            (filledFields.length > 0
              ? copy.readFields(filledFields.length)
              : copy.nothingRecognised)}
          {status === 'filled' && copy.filled}
          {status === 'failed' && error && localizeIntakeError(error, locale)}
        </p>
      </div>

      {dictationError && (
        <p role="alert" className="mt-2 mb-0 type-meta text-status-danger">
          {dictationError.message}
        </p>
      )}

      {/* What was understood, in the form's own words, so it can be checked without hunting. */}
      {status === 'review' && filledFields.length > 0 && (
        <div className="mt-3 rounded-xl border border-control-border/50 bg-surface-card p-3">
          {wasTranslated && result?.sourceLanguage && (
            <p className="mt-0 mb-2 type-meta text-notice-secondary">
              {copy.translated(localizeLanguageName(result.sourceLanguage, locale))}
            </p>
          )}

          {ordinaryFields.length > 0 && (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {ordinaryFields.map((key) => (
                <div key={key} className="flex gap-2 type-meta">
                  <dt className="text-notice-muted">{fieldLabel(key, copy)}</dt>
                  <dd className="m-0 text-notice-primary">
                    {describeValue(
                      key,
                      (draft as Record<string, unknown>)[key],
                      copy,
                      locale,
                      readBack,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/*
           * Allergies and medications are separated out and gated behind their own tick. They are
           * the two fields where a misheard word or a loose translation could reach the animal, and
           * a single "looks right" over the whole draft is not a decision about them.
           */}
          {needsMedicalConfirmation && (
            <div
              role="group"
              aria-label={copy.medicalGroupLabel}
              className="mt-3 rounded-xl border border-status-danger/40 bg-status-danger/5 p-3"
            >
              <p className="mt-0 mb-2 type-meta font-semibold text-notice-primary">
                {copy.checkCarefully}
              </p>
              <dl className="m-0 grid gap-y-1">
                {medicalFields.map((key) => (
                  <div key={key} className="flex gap-2 type-meta">
                    <dt className="shrink-0 text-notice-muted">{fieldLabel(key, copy)}</dt>
                    <dd className="m-0 text-notice-primary">
                      {describeValue(
                        key,
                        (draft as Record<string, unknown>)[key],
                        copy,
                        locale,
                        readBack,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <label
                htmlFor={medicalCheckboxId}
                className="mt-3 flex cursor-pointer items-start gap-2 type-meta text-notice-primary"
              >
                <input
                  id={medicalCheckboxId}
                  type="checkbox"
                  checked={isMedicalConfirmed}
                  onChange={(event) => setIsMedicalConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{copy.medicalConfirm}</span>
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              className="min-h-11 rounded-xl bg-theme-sun px-4 type-button text-on-sun transition-colors hover:bg-theme-sun-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
            >
              {copy.confirm}
            </button>
            <button
              type="button"
              onClick={discard}
              className="min-h-11 rounded-xl border border-control-border px-4 type-button text-notice-secondary transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus"
            >
              {copy.discard}
            </button>

            {needsMedicalConfirmation && !isMedicalConfirmed && (
              <span className="type-meta text-notice-muted">{copy.tickToContinue}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

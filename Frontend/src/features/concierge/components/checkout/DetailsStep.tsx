import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConciergeCopy, DetailsField } from '../../copy';
import { useConciergeCheckout } from '../../hooks/useConciergeCheckout';
import { selectBookedNeeds, useConciergeStore } from '../../store/conciergeStore';
import {
  validateDetails,
  type DetailsContactDraft,
  type DetailsDraft,
  type DetailsErrors,
  type DetailsPetDraft,
} from '../../utils/validateDetails';
import {
  CARD_TITLE,
  ERROR_TEXT,
  GROUP_LEGEND,
  PRIMARY_BUTTON,
  SURFACE_CARD,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { AgreementFields } from './AgreementFields';
import { ContactFieldset } from './ContactFieldset';
import { CareNotes, TimeChoice } from './DetailsFields';
import { DetailsPets } from './DetailsPets';
import { DetailsSummary } from './DetailsSummary';
import { DetailsVoiceFill } from './DetailsVoiceFill';
import { applyDetailsDraft } from '../../utils/applyDetailsDraft';

interface DetailsStepProps {
  copy: ConciergeCopy;
  onBack: () => void;
  /** Opens the sign-in dialog over this screen, so a lapsed session loses nothing typed. */
  onSignIn: () => void;
}

/**
 * Everything checkout needs, on one screen, with the request summarised beside it.
 *
 * Sending asks our manager for the stay: nothing is paid online. The guest pays at the desk after
 * the arrival health check.
 */
export const DetailsStep: React.FC<DetailsStepProps> = ({ copy, onBack, onSignIn }) => {
  // The agreed plan, never an edit made after agreeing: this is what the booking will hold.
  const needs = useConciergeStore(selectBookedNeeds);
  const accepted = useConciergeStore((state) => state.accepted);
  const agreedQuote = useConciergeStore((state) => state.agreedQuote);
  const locale = useConciergeStore((state) => state.locale);
  const verifiedEmail = useConciergeStore((state) => state.verifiedEmail);
  const draft = useConciergeStore((state) => state.detailsDraft);
  const initDetailsDraft = useConciergeStore((state) => state.initDetailsDraft);
  const updateDetailsDraft = useConciergeStore((state) => state.updateDetailsDraft);
  // Links change when the account's saved pets arrive, and the pet rows are rebuilt for them.
  const savedPetLinks = useConciergeStore((state) => state.savedPetLinks);
  const checkout = useConciergeCheckout();
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const { details } = copy;
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryId = useId();
  // Decided once: the hint says the notes came from the chat until the guest leaves this step.
  const [notesFromChat] = useState(() => needs.notes.trim().length > 0);

  useEffect(() => {
    initDetailsDraft();
  }, [initDetailsDraft, savedPetLinks]);

  // After a refused press, the first field that needs attention gets the cursor.
  useEffect(() => {
    if (focusRequest === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  if (!draft) return null;

  const localErrors = validateDetails(draft, checkout.needsContact);
  const errors: DetailsErrors = { ...localErrors, ...checkout.serverFieldErrors };
  const visibleError = (key: string): string | null => {
    const field: DetailsField | undefined = errors[key];
    if (!field) return null;
    return submitAttempted || touched.has(key) ? details.errors[field] : null;
  };
  const touch = (key: string) => (): void =>
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));

  const setContact = <K extends keyof DetailsContactDraft>(
    key: K,
    value: DetailsContactDraft[K],
  ): void =>
    updateDetailsDraft((current) => ({
      ...current,
      contact: { ...current.contact, [key]: value },
    }));
  const setPet = (index: number, change: Partial<DetailsPetDraft>): void =>
    updateDetailsDraft((current) => ({
      ...current,
      pets: current.pets.map((pet, petIndex) => (petIndex === index ? { ...pet, ...change } : pet)),
    }));
  const setField = <K extends keyof DetailsDraft>(key: K, value: DetailsDraft[K]): void =>
    updateDetailsDraft((current) => ({ ...current, [key]: value }));

  const busy = checkout.submitting;
  const onSubmit = async (): Promise<void> => {
    if (busy) return;
    setSubmitAttempted(true);
    if (Object.keys(localErrors).length > 0) {
      setFocusRequest((count) => count + 1);
      return;
    }
    await checkout.submit(draft);
  };

  const errorList = submitAttempted
    ? Array.from(new Set(Object.values(errors).filter((field): field is DetailsField => !!field)))
    : [];
  const failure = errorList.length === 0 ? checkout.error : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <DetailsSummary
        copy={copy}
        locale={locale}
        needs={needs}
        accepted={accepted}
        quote={agreedQuote}
        verifiedEmail={verifiedEmail}
        titleId={summaryId}
        onBack={onBack}
      />

      <div className={`${SURFACE_CARD} flex min-w-0 flex-col gap-8 p-6 sm:p-8`}>
        <div>
          <h2
            id="concierge-step-title"
            tabIndex={-1}
            className={`${CARD_TITLE} focus:outline-none`}
          >
            {details.title}
          </h2>
          <p className="mb-0 mt-2 type-body text-notice-secondary">{details.lead}</p>
        </div>

        <form
          ref={formRef}
          noValidate
          aria-labelledby="concierge-step-title"
          className="flex flex-col gap-8"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <DetailsVoiceFill
            copy={copy}
            onUse={(read) =>
              updateDetailsDraft((current) =>
                applyDetailsDraft(current, read, checkout.needsContact),
              )
            }
          />

          {checkout.needsContact && (
            <ContactFieldset
              copy={copy}
              contact={draft.contact}
              visibleError={visibleError}
              touch={touch}
              onChange={setContact}
              onSignIn={onSignIn}
            />
          )}

          <DetailsPets
            copy={copy}
            petNeeds={needs.pets}
            pets={draft.pets}
            visibleError={visibleError}
            touch={touch}
            onChange={setPet}
          />

          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className={GROUP_LEGEND}>{details.times}</legend>
            <div className="grid grid-cols-2 gap-4">
              <TimeChoice
                label={details.dropOff}
                locale={locale}
                value={draft.dropOffTime}
                error={visibleError('dropOffTime')}
                onBlur={touch('dropOffTime')}
                onChange={(value) => setField('dropOffTime', value)}
              />
              <TimeChoice
                label={details.pickUp}
                locale={locale}
                value={draft.pickUpTime}
                error={visibleError('pickUpTime')}
                onBlur={touch('pickUpTime')}
                onChange={(value) => setField('pickUpTime', value)}
              />
            </div>
          </fieldset>

          <CareNotes
            copy={copy}
            value={draft.careNotes}
            fromChat={notesFromChat}
            onChange={(careNotes) => setField('careNotes', careNotes)}
          />

          <p className="m-0 type-body text-notice-secondary">{details.payAtDesk}</p>

          <AgreementFields
            copy={copy}
            termsAccepted={draft.termsAccepted}
            vetConsent={draft.vetConsent}
            visibleError={visibleError}
            touch={touch}
            onTermsChange={(termsAccepted) => setField('termsAccepted', termsAccepted)}
            onVetConsentChange={(vetConsent) => setField('vetConsent', vetConsent)}
          />

          {errorList.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-status-danger/40 bg-status-danger/5 p-4"
            >
              <p className="m-0 type-body font-semibold text-status-danger">
                {details.fixTitle(errorList.length)}
              </p>
              <ul className="mb-0 mt-2 list-disc pl-5 type-meta text-notice-primary">
                {errorList.map((field) => (
                  <li key={field}>{details.errors[field]}</li>
                ))}
              </ul>
            </div>
          )}

          {failure && (
            <div role="alert" className="flex flex-col gap-2">
              <p className={ERROR_TEXT}>{failure}</p>
              {checkout.needsSignIn && (
                // The session lapsed while the form was open (8 hours, or a sign-out in another
                // tab). Signing in again happens over this screen, so nothing typed is lost.
                <button
                  type="button"
                  onClick={onSignIn}
                  className={`${TEXT_BUTTON} self-start px-0`}
                >
                  {copy.verify.signInAgain}
                </button>
              )}
              {checkout.alreadySentReference && (
                <Link to="/parent/stays" className={`${TEXT_BUTTON} self-start px-0`}>
                  {copy.done.myStays}
                </Link>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onBack} className={TEXT_BUTTON}>
              ← {details.back}
            </button>
            <button
              type="submit"
              aria-disabled={busy}
              className={`${PRIMARY_BUTTON} aria-disabled:cursor-wait aria-disabled:opacity-70`}
            >
              {busy ? details.submitting : details.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

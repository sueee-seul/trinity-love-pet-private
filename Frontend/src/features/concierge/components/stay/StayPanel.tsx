import React, { useEffect, useRef, useState } from 'react';
import type { ConciergeCopy } from '../../copy';
import { useAgreeToStay } from '../../hooks/useAgreeToStay';
import { useBookRequested } from '../../hooks/useBookRequested';
import {
  selectAssistantThinking,
  selectCombosStale,
  selectRepricing,
  useConciergeStore,
} from '../../store/conciergeStore';
import { CARD_TITLE, SECONDARY_BUTTON, TEXT_BUTTON } from '../conciergeStyles';
import { StayBuilder } from './StayBuilder';
import { StayCombos } from './StayCombos';
import { StayTotal } from './StayTotal';
import { SampleCareDay } from './SampleCareDay';

interface StayPanelProps {
  copy: ConciergeCopy;
  /** Booking online is off (no card processor): continuing hands the plan to the team instead. */
  handoff: boolean;
  onHandoff: () => void;
}

/** From here the panel is a drawer beside the page; below it is a sheet over the page. */
const DRAWER_QUERY = '(min-width: 768px)';

const isDrawerWidth = (): boolean =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DRAWER_QUERY).matches;

/** Facts that are true today, next to the price: the reassurance competitors bury in terms. */
const PromiseStrip: React.FC<{ copy: ConciergeCopy }> = ({ copy }) => (
  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
    {copy.packages.promises.map((promise) => (
      <li
        key={promise}
        className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-3 py-1.5 type-meta font-semibold text-status-success"
      >
        <span aria-hidden="true">✓</span>
        {promise}
      </li>
    ))}
  </ul>
);

/**
 * The floating stay: the suggested combos, every service as a choice of its own, and the live
 * total. A native <dialog>: from 768px a full-height card floating on the right of the page that
 * leaves the chat usable, so the guest can keep talking while watching the price; below that a
 * bottom sheet shown modally, with
 * the page behind it still. Escape closes it, the keyboard lands inside when it opens (unless the
 * guest has just clicked into the chat box) and goes back where it was on close.
 */
export const StayPanel: React.FC<StayPanelProps> = ({ copy, handoff, onHandoff }) => {
  const open = useConciergeStore((state) => state.stayPanelOpen);
  const opener = useConciergeStore((state) => state.stayPanelOpener);
  const locale = useConciergeStore((state) => state.locale);
  const combos = useConciergeStore((state) => state.combos);
  const catalogue = useConciergeStore((state) => state.catalogue);
  const selection = useConciergeStore((state) => state.selection);
  const stayQuote = useConciergeStore((state) => state.stayQuote);
  const pricing = useConciergeStore((state) => state.pricing);
  const pricingError = useConciergeStore((state) => state.pricingError);
  const appliedComboId = useConciergeStore((state) => state.appliedComboId);
  const pets = useConciergeStore((state) => (state.pricedNeeds ?? state.needs).pets);
  const priceNotice = useConciergeStore((state) => state.priceNotice);
  const repricing = useConciergeStore(selectRepricing);
  const thinking = useConciergeStore(selectAssistantThinking);
  // The last checklist re-price failed, so the combos no longer match the plan: offer a retry.
  const repriceFailed = useConciergeStore(
    (state) => state.turnStatus === 'error' && selectCombosStale(state),
  );
  const retryLastTurn = useConciergeStore((state) => state.retryLastTurn);
  const applyCombo = useConciergeStore((state) => state.applyCombo);
  const setPetRoom = useConciergeStore((state) => state.setPetRoom);
  const setPetFood = useConciergeStore((state) => state.setPetFood);
  const togglePetAddon = useConciergeStore((state) => state.togglePetAddon);
  const repriceStay = useConciergeStore((state) => state.repriceStay);
  const closeStayPanel = useConciergeStore((state) => state.closeStayPanel);
  const { agree, agreeing, error: agreeError } = useAgreeToStay();
  useBookRequested({ handoff, agree, agreeing });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<Element | null>(null);
  // Decided when the panel opens: a sheet over the page (modal) or a drawer beside it.
  const [modal, setModal] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement;
      const asSheet = !isDrawerWidth();
      setModal(asSheet);
      if (asSheet && typeof dialog.showModal === 'function') dialog.showModal();
      else if (typeof dialog.show === 'function') dialog.show();
      else dialog.setAttribute('open', '');
      // The sheet covers the page, so the page must not scroll under a thumb.
      if (asSheet) document.body.style.overflow = 'hidden';
      if (opener !== 'composer') headingRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      document.body.style.overflow = '';
      const previous = returnTo.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    }
  }, [open, opener]);

  // Leaving the page with the sheet open would leave the body locked.
  useEffect(
    () => (): void => {
      document.body.style.overflow = '';
    },
    [],
  );

  const petNames = pets.map((pet) => pet.name);
  const problem = pricingError
    ? pricingError(copy)
    : repriceFailed
      ? copy.packages.repriceFailed
      : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="concierge-stay-title"
      aria-modal={open && modal ? 'true' : 'false'}
      data-a11y-surface=""
      onClose={closeStayPanel}
      onCancel={(event) => {
        event.preventDefault();
        closeStayPanel();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeStayPanel();
        }
      }}
      /*
       * Fixed to the window, not centred like a modal: from 768px a card floating on the right
       * that runs the full height of the window, clear of the edges and below the page header, so
       * the combos and the total both have room; from 1024px it widens so the suggested combos sit
       * side by side and all show without scrolling; a sheet along the bottom below 768px. The veil uses the
       * shadow tint, as every dialog here does.
       */
      className="fixed inset-x-0 bottom-0 top-auto z-30 m-0 h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl open:flex border border-border-soft bg-surface-card p-0 text-notice-primary shadow-card backdrop:bg-shadow-tint/40 md:inset-x-auto md:top-(--concierge-sticky-top) md:right-6 md:bottom-6 md:h-auto md:max-h-none md:w-[min(560px,calc(100vw-3rem))] lg:w-[min(920px,calc(100vw-3rem))] md:rounded-3xl md:shadow-[0_16px_48px_color-mix(in_srgb,var(--color-shadow-tint)_22%,transparent)] print:hidden"
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h2
                id="concierge-stay-title"
                ref={headingRef}
                tabIndex={-1}
                className={`${CARD_TITLE} focus:outline-none`}
              >
                {copy.packages.title}
              </h2>
              <p className="mb-0 mt-1 type-meta text-notice-secondary">{copy.packages.lead}</p>
            </div>
            <button type="button" onClick={closeStayPanel} className={`${TEXT_BUTTON} -mr-2`}>
              {copy.packages.close}
            </button>
          </div>

          <div className="@container flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-4">
            <p role="status" aria-live="polite" className="m-0 empty:hidden">
              {priceNotice ? (
                <span className="block rounded-2xl bg-surface-cream px-4 py-3 type-body font-semibold">
                  {priceNotice(copy)}
                </span>
              ) : null}
            </p>
            {repriceFailed && (
              <button
                type="button"
                onClick={() => void retryLastTurn()}
                className={`${SECONDARY_BUTTON} self-start px-4`}
              >
                {copy.chat.retry}
              </button>
            )}

            <section aria-labelledby="concierge-stay-combos-title">
              <h3 id="concierge-stay-combos-title" className="m-0 mb-3 type-card-title font-normal">
                {copy.packages.suggestedTitle}
              </h3>
              <StayCombos
                copy={copy}
                locale={locale}
                combos={combos}
                appliedComboId={appliedComboId}
                petNames={petNames}
                onUse={applyCombo}
              />
            </section>

            {/* Below the combos, so the suggestions open at the top of the panel. */}
            <PromiseStrip copy={copy} />

            {catalogue && selection && (
              <section aria-labelledby="concierge-stay-build-title">
                <h3 id="concierge-stay-build-title" className="m-0 type-card-title font-normal">
                  {copy.packages.buildTitle}
                </h3>
                <p className="mb-3 mt-1 type-meta text-notice-secondary">
                  {copy.packages.buildLead}
                </p>
                <StayBuilder
                  copy={copy}
                  locale={locale}
                  catalogue={catalogue}
                  pets={pets}
                  selection={selection.pets}
                  disabled={thinking}
                  onRoom={setPetRoom}
                  onFood={setPetFood}
                  onAddon={togglePetAddon}
                />
              </section>
            )}

            <SampleCareDay copy={copy} />

            <section
              aria-labelledby="concierge-stay-next-title"
              className="rounded-2xl border border-border-soft bg-surface-cream/60 p-4"
            >
              <h3 id="concierge-stay-next-title" className="m-0 type-card-title font-normal">
                {copy.packages.nextStepsTitle}
              </h3>
              <ol className="mb-0 mt-3 flex list-none flex-col gap-2 p-0">
                {copy.packages.nextSteps.map((stepText, index) => (
                  <li key={stepText} className="flex items-start gap-3 type-meta">
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-control-border font-bold tabular-nums text-notice-primary"
                    >
                      {index + 1}
                    </span>
                    <span className="text-notice-primary">{stepText}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="@container border-t border-border-soft bg-surface-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <StayTotal
              copy={copy}
              locale={locale}
              quote={stayQuote}
              petNames={petNames}
              updating={repricing}
              priceFailed={pricing === 'error'}
              problem={problem}
              onRetryPrice={() => void repriceStay()}
              handoff={handoff}
              onHandoff={onHandoff}
              onContinue={agree}
              agreeing={agreeing}
              agreeError={agreeError}
            />
          </div>
        </>
      )}
    </dialog>
  );
};

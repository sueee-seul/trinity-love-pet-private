import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeLaceEdge } from '../../../shared/theme/decorations/ThemeLaceEdge';
import { PageHeader, PortalPage } from '../../pet-parent/components/layout/PortalPage';
import '../concierge.css';
import { CONCIERGE_COPY } from '../copy';
import { useAccountPets } from '../hooks/useAccountPets';
import { useConciergeStatus } from '../hooks/useConciergeStatus';
import { useLastStay } from '../hooks/useLastStay';
import { useSignedInPetOwner } from '../hooks/useSignedInPetOwner';
import { useStepHistory } from '../hooks/useStepHistory';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { selectCombosStale, useConciergeStore } from '../store/conciergeStore';
import { useQuickConfirmOpen, useQuickConfirmStore } from '../store/quickConfirm';
import type { ConciergeStep } from '../types';
import { ChatPanel } from './chat/ChatPanel';
import { ConfirmationStep } from './checkout/ConfirmationStep';
import { DetailsStep } from './checkout/DetailsStep';
import { QuickConfirmCard } from './checkout/QuickConfirmCard';
import { SignInDialog } from './checkout/SignInDialog';
import { ConciergeHeader, ConciergeHelpNav } from './ConciergeHeader';
import { HandoffPanel } from './HandoffPanel';
import { AI_CHAT_PAGE_PATH } from '../../pet-parent/ai-chat/chatRoutes';
import { sendToTeamInChat } from '../../pet-parent/ai-chat/sendToTeamInChat';
import { NeedsChecklist } from './needs/NeedsChecklist';
import { SavedPetChips } from './needs/SavedPetChips';
import { FullyBookedNotice } from './stay/FullyBookedNotice';
import { StayPanel } from './stay/StayPanel';
import { RatesStrip } from './RatesStrip';
import { StepRail } from './StepRail';

/**
 * The page's one content width, shared by the column inside the hero band and the steps below.
 * `.concierge-hero-copy` in concierge.css repeats these gutters, so change both together.
 */
const PAGE_COLUMN = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

/**
 * How far below the top of the window the stay card and the request summary stick from `lg`. The
 * portal pins its own top bar (5rem) above the page, so there they stop below it.
 */
const STICKY_TOP = {
  standalone: '[--concierge-sticky-top:1.5rem]',
  portal: '[--concierge-sticky-top:6.5rem]',
} as const;

/**
 * The stay card beside the chat from `lg`. It spans every row of the left column, so it can stick
 * while the chat scrolls, and a long card (four pets) scrolls inside itself instead of running off
 * the bottom of the screen.
 */
const STAY_CARD_PLACEMENT =
  'min-w-0 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-(--concierge-sticky-top) lg:max-h-[calc(100dvh-var(--concierge-sticky-top)-1.5rem)] lg:overflow-y-auto lg:overscroll-contain';

/**
 * The /book title sits alone on the hero band, the page's poster, so it is set larger than the
 * portal's page titles. One clamp keeps it between a phone and a wide screen.
 */
const HERO_TITLE =
  'm-0 max-w-[20ch] text-balance font-agbalumo text-[clamp(32px,5vw,52px)] font-normal leading-[1.08] text-hero-ink focus:outline-none';

/** Every tab title on this page ends with the brand, as `copy.documentTitle` does. */
const DOCUMENT_TITLE_SUFFIX = ' · Wagstay';

interface ConciergePageProps {
  /**
   * `standalone`: the public page at /book, with its own brand bar on the theme's hero band.
   * `portal`: inside the signed-in parent portal, which already draws the navigation.
   */
  variant: 'standalone' | 'portal';
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The AI booking concierge: say what you need (or tap answers), see suggested stays with the full
 * price in the floating stay panel, take one or build your own, sign in (or create an account),
 * add a few details and agree to the terms, and the request is sent. One screen per step; the
 * planning screen holds the chat and the stay card, with the stay panel floating over them.
 */
export const ConciergePage: React.FC<ConciergePageProps> = ({ variant }) => {
  const locale = useConciergeStore((state) => state.locale);
  const step = useConciergeStore((state) => state.step);
  const needs = useConciergeStore((state) => state.needs);
  const missingFields = useConciergeStore((state) => state.missingFields);
  const comboCount = useConciergeStore((state) => state.combos.length);
  const fullNights = useConciergeStore((state) => state.fullNights);
  const priceNotice = useConciergeStore((state) => state.priceNotice);
  const accepted = useConciergeStore((state) => state.accepted);
  const checkoutResult = useConciergeStore((state) => state.checkoutResult);
  const verifiedEmail = useConciergeStore((state) => state.verifiedEmail);
  const turnStatus = useConciergeStore((state) => state.turnStatus);
  const refreshPending = useConciergeStore((state) => state.refreshPending);
  const combosStale = useConciergeStore(selectCombosStale);
  const goTo = useConciergeStore((state) => state.goTo);
  const backToOptions = useConciergeStore((state) => state.backToOptions);
  const quickConfirmOpen = useQuickConfirmOpen();
  const closeQuickConfirm = useQuickConfirmStore((state) => state.close);
  const refreshQuotes = useConciergeStore((state) => state.refreshQuotes);
  const signedIn = useSignedInPetOwner();
  // True until the app shell has asked the server who is signed in; nothing is decided before.
  const sessionLoading = useAuthStore((state) => state.isHydrating);
  const navigate = useNavigate();
  const status = useConciergeStatus();
  const setAssistantMode = useConciergeStore((state) => state.setAssistantMode);
  // The greeting names what is answering; the server knows that before the first turn.
  useEffect(() => {
    if (status.assistantMode) setAssistantMode(status.assistantMode);
  }, [status.assistantMode, setAssistantMode]);
  useAccountPets();
  useLastStay();
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const copy = CONCIERGE_COPY[locale];
  const standalone = variant === 'standalone';
  // Booking online needs a room count. Without it nobody can book, so continuing hands the plan
  // to the team instead, said up front rather than after the last question. Unknown (not read
  // yet) never counts as impossible.
  const handoff = !status.onlineBooking;

  // There is no sign-in step any more: a first-time guest makes their account on the details step.
  // A plan saved on the old step (?step=verify) opens the details instead.
  useEffect(() => {
    if (step === 'verify') goTo('details');
  }, [step, goTo]);

  // Options that no longer match the plan (a reload after the holds ran out, a re-price that was
  // interrupted, a return from a later step) are priced again, quietly. It happens once per version
  // of the plan, so a failing server is never asked in a loop.
  const autoRepricedFor = useRef<string | null>(null);
  const needsKey = JSON.stringify(needs);
  useEffect(() => {
    if (step !== 'plan' || turnStatus !== 'idle' || refreshPending) return;
    const owed = combosStale || (comboCount === 0 && missingFields.length === 0);
    if (!owed || autoRepricedFor.current === needsKey) return;
    autoRepricedFor.current = needsKey;
    void refreshQuotes();
  }, [
    step,
    turnStatus,
    refreshPending,
    combosStale,
    comboCount,
    missingFields.length,
    needsKey,
    refreshQuotes,
  ]);

  const moveTo = useCallback(
    (target: ConciergeStep): void => {
      if (target === 'plan') backToOptions();
      else goTo(target);
    },
    [backToOptions, goTo],
  );
  const canShow = useCallback(
    (target: ConciergeStep): boolean => {
      if (target === 'plan') return true;
      if (target === 'verify') return false;
      if (target === 'details') return accepted !== null;
      return checkoutResult !== null;
    },
    [accepted, checkoutResult],
  );
  useStepHistory(step, moveTo, canShow);

  // Each step is a new screen: it starts at the top, the tab says where the guest is, and the
  // keyboard (and a screen reader) lands on the step's heading instead of a button that is gone.
  const firstStep = useRef(step);
  useEffect(() => {
    // The Sent screen's tab says what happened: confirmed, sent, or waiting for review.
    document.title =
      step === 'done' && checkoutResult
        ? `${copy.done.titles[checkoutResult.status]}${DOCUMENT_TITLE_SUFFIX}`
        : copy.documentTitle[step];
  }, [copy, step, checkoutResult]);
  // The title the app had before this page, captured on the first render (before any write).
  const originalTitle = useRef(document.title);
  useEffect(() => {
    const titleToRestore = originalTitle;
    return (): void => {
      document.title = titleToRestore.current;
    };
  }, []);
  useEffect(() => {
    if (step === firstStep.current) return;
    firstStep.current = step;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // A frame later, so a step that prepares its form on mount has drawn its heading.
    const frame = requestAnimationFrame(() => {
      // The portal's page title cannot take focus, so on the plan the chat heading comes first.
      const target =
        document.getElementById('concierge-step-title') ??
        (step === 'plan' ? document.getElementById('concierge-chat-title') : null) ??
        document.getElementById('concierge-page-title');
      target?.focus({ preventScroll: true });
    });
    return (): void => cancelAnimationFrame(frame);
  }, [step]);

  // A signed-in parent already has a chat with the team, so "Talk to a person" opens it; a guest
  // has none and gets the panel to send the plan, email or call instead.
  const talkToPerson = (): void => {
    if (signedIn) navigate(AI_CHAT_PAGE_PATH);
    else setHandoffOpen(true);
  };

  const content =
    step === 'plan' ? (
      // The reading and keyboard order is the phone's order: the chat first (the thing to do),
      // then the stay card with what is still missing. From `lg` the stay card moves beside the
      // chat. The stay panel floats over both and is reached from the chat.
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {signedIn && (
          <div className="min-w-0 lg:col-start-1">
            <SavedPetChips copy={copy} />
          </div>
        )}
        <div className="min-w-0 lg:col-start-1">
          <ChatPanel copy={copy} aiProcessing={status.aiProcessing} onTalkToPerson={talkToPerson} />
        </div>
        {quickConfirmOpen && (
          <div className="min-w-0 lg:col-start-1">
            <QuickConfirmCard
              copy={copy}
              chatOpen
              onEditDetails={() => {
                closeQuickConfirm();
                goTo('details');
              }}
            />
          </div>
        )}
        <NeedsChecklist
          copy={copy}
          className={`${STAY_CARD_PLACEMENT} ${signedIn ? 'lg:row-span-3' : 'lg:row-span-2'}`}
        />
        {comboCount === 0 && fullNights.length > 0 && (
          <div className="min-w-0 lg:col-start-1">
            <FullyBookedNotice
              copy={copy}
              locale={locale}
              fullNights={fullNights}
              notice={priceNotice ? priceNotice(copy) : null}
            />
          </div>
        )}
        <StayPanel copy={copy} handoff={handoff} onHandoff={() => setHandoffOpen(true)} />
      </div>
    ) : step === 'details' ? (
      // Not before the session is known: a guest's form also makes their account.
      sessionLoading ? null : quickConfirmOpen ? (
        <div className="mx-auto w-full max-w-2xl">
          <QuickConfirmCard copy={copy} chatOpen={false} onEditDetails={closeQuickConfirm} />
        </div>
      ) : (
        <DetailsStep copy={copy} onBack={backToOptions} onSignIn={() => setSignInOpen(true)} />
      )
    ) : checkoutResult ? (
      <ConfirmationStep copy={copy} result={checkoutResult} email={verifiedEmail} />
    ) : null;

  const lang = locale === 'zh' ? 'zh-Hans' : 'en-NZ';

  const helpNav = {
    copy,
    signedIn,
    onTalkToPerson: talkToPerson,
    onSignIn: (): void => setSignInOpen(true),
  };

  // The plan's opening lines: what the page does, a real price, and the team when cards are off.
  const planIntro =
    step === 'plan' ? (
      <div className="flex min-w-0 flex-col gap-3">
        {/* On phones the greeting says the same, and the chat belongs in the first screen. */}
        <p
          className={`m-0 hidden max-w-[62ch] type-body ${standalone ? 'text-hero-ink/80' : 'text-notice-secondary'} sm:block`}
        >
          {copy.pageLead}
        </p>
        <RatesStrip copy={copy} onHeroBand={standalone} />
        {handoff && (
          <p className="m-0 max-w-[70ch] rounded-2xl border border-control-border bg-surface-card px-4 py-3 type-body">
            {copy.bookingOffNotice}
          </p>
        )}
      </div>
    ) : null;

  const steps = (
    <>
      <StepRail copy={copy} step={step} hasOptions={comboCount > 0} skipVerify />
      {content}
      <HandoffPanel
        copy={copy}
        status={status}
        open={handoffOpen}
        onClose={() => setHandoffOpen(false)}
        {...(signedIn
          ? {
              // A signed-in parent already has a chat with our team, so the plan goes there.
              onSendInChat: async (plan: string): Promise<void> => {
                await sendToTeamInChat(plan);
                setHandoffOpen(false);
                navigate(AI_CHAT_PAGE_PATH);
              },
            }
          : {
              // The sign-in dialog opens over the plan, which stays in this tab.
              onSignIn: (): void => {
                setHandoffOpen(false);
                setSignInOpen(true);
              },
            })}
      />
      <SignInDialog copy={copy} open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );

  // Inside the portal the shell draws the navigation and the background, so there is no band, and
  // the title is the portal's one page title.
  if (!standalone) {
    return (
      <div lang={lang} className={`concierge-page parent-type-scale ${STICKY_TOP.portal}`}>
        <PortalPage width="wide">
          <PageHeader
            title={copy.pageTitle}
            titleId="concierge-page-title"
            actions={<ConciergeHelpNav {...helpNav} standalone={false} />}
          />
          {planIntro}
          {steps}
        </PortalPage>
      </div>
    );
  }

  return (
    <div
      lang={lang}
      className={`concierge-page parent-type-scale min-h-dvh bg-surface-cream ${STICKY_TOP.standalone}`}
    >
      <main className="theme-pattern pb-[max(6rem,env(safe-area-inset-bottom))] lg:pb-12">
        {/*
         * The theme's picture lives in this band and nowhere else on the page: the header, the
         * title and the price line sit on its plain left side, and the chat and stay card below
         * stay on the page colour. The band is full width, so the column inside it holds the
         * page's own width.
         */}
        <div className="theme-hero-band">
          <div
            className={`${PAGE_COLUMN} flex flex-col pt-6 pb-8 sm:pt-8 sm:pb-10 md:min-h-[340px] md:pb-12 lg:min-h-[420px] lg:pb-14 xl:min-h-[460px]`}
          >
            <div className="concierge-hero-copy flex min-w-0 flex-1 flex-col gap-6 sm:gap-8">
              <ConciergeHeader {...helpNav} />
              {/* The title block takes the height the header leaves and centres in it. */}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                <h1 id="concierge-page-title" tabIndex={-1} className={HERO_TITLE}>
                  {copy.pageTitle}
                </h1>
                {planIntro}
              </div>
            </div>
          </div>
        </div>
        <div className="concierge-hero-edge -mt-px print:hidden">
          <ThemeLaceEdge />
        </div>
        <div className={`${PAGE_COLUMN} flex flex-col gap-6 pt-4 sm:gap-8 sm:pt-6`}>{steps}</div>
      </main>
    </div>
  );
};

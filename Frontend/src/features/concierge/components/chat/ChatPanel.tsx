import { ConciergeIllustration as Illustration } from '../ConciergeIllustration';
import React, { useEffect, useRef, useState } from 'react';
import type { ConciergeCopy } from '../../copy';
import type { AiProcessingDisclosure } from '../../types';
import { useSignedInPetOwner } from '../../hooks/useSignedInPetOwner';
import { useLastStayStore } from '../../store/lastStay';
import {
  MISSES_BEFORE_HELP,
  selectAssistantThinking,
  selectHasStay,
  useConciergeStore,
} from '../../store/conciergeStore';
import { formatNzd, todayInNewZealand } from '../../utils/format';
import { useQuickConfirmOpen, useQuickConfirmStore } from '../../store/quickConfirm';
import { buildQuickReplies } from '../../utils/quickReplies';
import { isConfirmReply } from '../../utils/quickConfirmReply';
import {
  CARD_TITLE,
  INLINE_TEXT_BUTTON,
  SECONDARY_BUTTON,
  SURFACE_CARD,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { CHIP, QuickReplies } from './QuickReplies';

interface ChatPanelProps {
  copy: ConciergeCopy;
  /** Where the assistant and voice-to-text run, from the server's status; null until read. */
  aiProcessing: AiProcessingDisclosure | null;
  onTalkToPerson: () => void;
}

/** The privacy notice lives at the point of collection, collapsed to one line until asked for. */
const PrivacyNotice: React.FC<{
  copy: ConciergeCopy;
  aiProcessing: AiProcessingDisclosure | null;
}> = ({ copy, aiProcessing }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border-soft bg-surface-cream/60 px-4 py-3 sm:px-6">
      <p className="m-0 type-meta text-notice-secondary">
        {copy.privacy.summary}{' '}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`${INLINE_TEXT_BUTTON} text-meta`}
        >
          {copy.privacy.detailsToggle}
        </button>
      </p>
      {open && (
        <ul className="mb-0 mt-2 list-disc space-y-1 pl-5 type-meta text-notice-secondary">
          {copy.privacy.details(aiProcessing).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Start over asks once, inline, so a stray tap never throws a plan away. */
const StartOver: React.FC<{ copy: ConciergeCopy; onConfirm: () => void }> = ({
  copy,
  onConfirm,
}) => {
  const [confirming, setConfirming] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // The keyboard follows the question: to "Keep my plan" when asked, back to "Start over" after.
  useEffect(() => {
    if (confirming) {
      keepRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      startRef.current?.focus();
    }
  }, [confirming]);

  if (!confirming) {
    return (
      // On a phone the header row has no room for the words beside the title, so the button shows
      // a restart arrow there and keeps its name for screen readers.
      <button
        ref={startRef}
        type="button"
        onClick={() => setConfirming(true)}
        title={copy.chat.startOver}
        className={`${TEXT_BUTTON} min-w-11 shrink-0 justify-center whitespace-nowrap`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 sm:hidden"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
        </svg>
        <span className="max-sm:sr-only">{copy.chat.startOver}</span>
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label={copy.chat.startOverConfirm}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="type-meta text-notice-secondary">{copy.chat.startOverConfirm}</span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className={TEXT_BUTTON}
      >
        {copy.chat.startOverYes}
      </button>
      <button
        ref={keepRef}
        type="button"
        onClick={() => {
          returnFocus.current = true;
          setConfirming(false);
        }}
        className={TEXT_BUTTON}
      >
        {copy.chat.startOverNo}
      </button>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ copy, aiProcessing, onTalkToPerson }) => {
  const messages = useConciergeStore((state) => state.messages);
  const locale = useConciergeStore((state) => state.locale);
  const needs = useConciergeStore((state) => state.needs);
  const missingFields = useConciergeStore((state) => state.missingFields);
  const comboCount = useConciergeStore((state) => state.combos.length);
  const hasStay = useConciergeStore(selectHasStay);
  const stayTotal = useConciergeStore((state) => state.stayQuote?.total ?? null);
  const openStayPanel = useConciergeStore((state) => state.openStayPanel);
  const plan = useConciergeStore((state) => state.plan);
  const turnStatus = useConciergeStore((state) => state.turnStatus);
  const turnError = useConciergeStore((state) => state.turnError);
  const canRetry = useConciergeStore((state) => state.lastFailedTrigger !== null);
  const assistantMode = useConciergeStore((state) => state.assistantMode);
  const assistantAvailable = useConciergeStore((state) => state.assistantAvailable);
  const missStreak = useConciergeStore((state) => state.missStreak);
  const restored = useConciergeStore((state) => state.restored);
  const sendMessage = useConciergeStore((state) => state.sendMessage);
  const noteGuestMessage = useConciergeStore((state) => state.noteGuestMessage);
  const quickConfirmOpen = useQuickConfirmOpen();
  const confirmFromChat = useQuickConfirmStore((state) => state.confirmFromChat);
  const chooseAnswer = useConciergeStore((state) => state.chooseAnswer);
  const retryLastTurn = useConciergeStore((state) => state.retryLastTurn);
  const setChecklistOpen = useConciergeStore((state) => state.setChecklistOpen);
  const dismissRestored = useConciergeStore((state) => state.dismissRestored);
  const startOver = useConciergeStore((state) => state.startOver);
  // The earlier stay is read only for a signed-in parent, and forgotten on sign-out.
  const signedIn = useSignedInPetOwner();
  const hasLastStay = useLastStayStore((state) => state.lastStay !== null);

  // Any turn in flight pauses the buttons; only a message or a tapped answer gets a reply, so
  // only those show the assistant thinking (a quiet re-price after a tick announces nothing).
  const busy = turnStatus === 'sending';
  const thinking = useConciergeStore(selectAssistantThinking);
  // Set by a tapped answer: once the reply arrives, the keyboard moves to the next question.
  const pendingChipFocus = useRef(false);
  const modeNotice = !assistantAvailable
    ? copy.chat.assistantDown
    : assistantMode === 'rules'
      ? copy.chat.rulesMode
      : null;
  const guestHasSpoken = messages.some((message) => message.role === 'user');
  const quickReplies = buildQuickReplies({
    copy,
    needs,
    missingFields,
    comboCount,
    isFirstTurn: !guestHasSpoken,
    hasLastStay: signedIn && hasLastStay,
    today: todayInNewZealand(),
    plan,
  });
  const replyLabel = quickReplies?.label ?? null;
  useEffect(() => {
    if (!pendingChipFocus.current || busy) return;
    pendingChipFocus.current = false;
    const next =
      document.querySelector<HTMLElement>(
        '#concierge-quick-replies button, #concierge-quick-replies input',
      ) ?? document.getElementById('concierge-chat-title');
    next?.focus();
  }, [replyLabel, busy]);
  const openChecklist = (): void => {
    setChecklistOpen(true);
    // The checklist is below the chat on phones; bring it into view.
    requestAnimationFrame(() =>
      document.getElementById('concierge-checklist')?.scrollIntoView({ block: 'start' }),
    );
  };

  return (
    <section
      aria-labelledby="concierge-chat-title"
      className={`${SURFACE_CARD} flex min-h-[420px] flex-col overflow-hidden sm:min-h-[520px] lg:min-h-[600px]`}
    >
      {/* On a narrow phone the controls drop under the title instead of squeezing it. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-4 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-action-dark font-fraunces text-body font-bold text-on-action-dark"
          >
            <Illustration
              name="assistant"
              caption={false}
              imageClassName="h-10 w-10 rounded-full object-cover"
            />
          </span>
          <div className="min-w-0">
            <h2
              id="concierge-chat-title"
              tabIndex={-1}
              className={`${CARD_TITLE} focus:outline-none`}
            >
              {copy.chat.title}
            </h2>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasStay && (
            // The way back to the prices at any time, with the total as it stands.
            <button
              type="button"
              onClick={() => openStayPanel('button')}
              className={`${SECONDARY_BUTTON} min-h-11 shrink-0 gap-2 px-4`}
            >
              {copy.packages.title}
              {stayTotal !== null && (
                <span className="rounded-full bg-action-dark px-2 py-0.5 type-meta font-semibold tabular-nums text-on-action-dark">
                  {formatNzd(stayTotal)}
                </span>
              )}
            </button>
          )}
          {guestHasSpoken && (
            <StartOver
              copy={copy}
              onConfirm={() => {
                startOver();
                // The confirm button is gone; the keyboard lands on the chat heading.
                requestAnimationFrame(() =>
                  document.getElementById('concierge-chat-title')?.focus(),
                );
              }}
            />
          )}
        </div>
      </div>
      <PrivacyNotice copy={copy} aiProcessing={aiProcessing} />
      {modeNotice && (
        <p className="m-0 border-b border-border-soft px-4 py-2 type-meta text-notice-secondary sm:px-6">
          {modeNotice}
        </p>
      )}
      {restored && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-status-success/10 px-4 py-2 sm:px-6"
        >
          <span className="type-meta text-notice-primary">{copy.chat.restored}</span>
          <button type="button" onClick={dismissRestored} className={TEXT_BUTTON}>
            ✓<span className="sr-only">{copy.verify.close}</span>
          </button>
        </div>
      )}
      <MessageList
        messages={messages}
        thinking={thinking}
        thinkingLabel={copy.chat.thinking}
        youLabel={copy.a11y.you}
        assistantLabel={copy.a11y.assistant}
        openStayLabel={copy.packages.openChip}
        onOpenStay={() => openStayPanel('button')}
      />
      {turnError && (
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 sm:px-6">
          <p role="alert" className="m-0 type-meta text-status-danger">
            {turnError(copy)}
          </p>
          {canRetry && (
            <button
              type="button"
              onClick={() => {
                if (!busy) void retryLastTurn();
              }}
              aria-disabled={busy}
              className={`${SECONDARY_BUTTON} min-h-11 px-4`}
            >
              {copy.chat.retry}
            </button>
          )}
        </div>
      )}
      {missStreak >= MISSES_BEFORE_HELP && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft px-4 py-3 sm:px-6">
          <span className="type-meta font-semibold text-notice-primary">{copy.chat.stuck}</span>
          <button type="button" onClick={openChecklist} className={CHIP}>
            {copy.chat.openChecklist}
          </button>
          <button type="button" onClick={onTalkToPerson} className={CHIP}>
            {copy.talkToPerson}
          </button>
        </div>
      )}
      {quickReplies && (
        <QuickReplies
          // A new question resets the date card and focus order.
          key={quickReplies.label}
          copy={copy}
          locale={locale}
          needs={needs}
          group={quickReplies}
          disabled={busy}
          onAnswer={(message, apply) => {
            pendingChipFocus.current = true;
            void chooseAnswer(message, apply);
          }}
          onSay={(message) => void sendMessage(message)}
          onOpenChecklist={openChecklist}
          onTalkToPerson={onTalkToPerson}
          onSeeOptions={() => openStayPanel('button')}
        />
      )}
      <Composer
        copy={copy}
        speech={aiProcessing?.speech ?? null}
        busy={busy}
        replying={thinking}
        onSend={(text) => {
          pendingChipFocus.current = false;
          // With the booking card open, a plain "confirm" presses its button instead of asking the
          // assistant again; the message still shows in the chat as the guest's own words.
          if (quickConfirmOpen && isConfirmReply(text)) {
            noteGuestMessage(text);
            confirmFromChat();
            return Promise.resolve();
          }
          return sendMessage(text);
        }}
        // Only once there is a stay to show: an empty panel would hide the chat for nothing.
        onFocus={() => {
          if (hasStay) openStayPanel('composer');
        }}
      />
    </section>
  );
};

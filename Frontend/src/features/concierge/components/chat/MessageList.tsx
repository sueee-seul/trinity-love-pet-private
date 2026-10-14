import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { ChatMarkdown } from '../../../../shared/components/ui/ChatMarkdown';
import type { ConciergeUiMessage } from '../../types';
import { CHIP } from './QuickReplies';

interface MessageListProps {
  messages: ConciergeUiMessage[];
  thinking: boolean;
  thinkingLabel: string;
  /** Screen-reader prefixes, in the page's language. */
  youLabel: string;
  assistantLabel: string;
  /** The chip under a reply that brought suggested stays, and what it does. */
  openStayLabel: string;
  onOpenStay: () => void;
}

/** Within this distance of the bottom counts as "reading the latest", so new messages follow. */
const STICK_TO_BOTTOM_PX = 80;

const MessageBubble: React.FC<{
  message: ConciergeUiMessage;
  youLabel: string;
  assistantLabel: string;
  openStayLabel: string;
  onOpenStay: () => void;
}> = ({ message, youLabel, assistantLabel, openStayLabel, onOpenStay }) => {
  const fromGuest = message.role === 'user';
  return (
    <li
      className={`flex flex-col gap-2 ${fromGuest ? 'items-end' : 'items-start'}`}
      data-message-id={message.id}
    >
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 type-body [overflow-wrap:anywhere] sm:max-w-[80%] ${
          fromGuest
            ? 'whitespace-pre-wrap rounded-br-md bg-action-dark text-on-action-dark'
            : message.tone === 'notice'
              ? 'rounded-bl-md border border-dashed border-control-border bg-surface-cream text-notice-secondary'
              : 'rounded-bl-md bg-surface-bubbles text-notice-primary'
        }`}
      >
        <span className="sr-only">{fromGuest ? youLabel : assistantLabel}</span>
        {/* The guest's own words are shown exactly as typed; replies show their light formatting. */}
        {fromGuest ? message.text : <ChatMarkdown text={message.text} />}
      </div>
      {message.offersStay && (
        <button type="button" onClick={onOpenStay} className={CHIP}>
          {openStayLabel}
        </button>
      )}
    </li>
  );
};

const ThinkingDots: React.FC<{ label: string }> = ({ label }) => (
  <li className="flex justify-start">
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface-bubbles px-4 py-3.5"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-notice-muted motion-safe:animate-bounce"
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  </li>
);

/**
 * The conversation. `role="log"` lets a screen reader announce each new message once. The list
 * scrolls itself only while the guest is already reading the latest, and a long reply is brought
 * into view at its first line, never scrolled past (NN/g chatbot guideline 7).
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  thinking,
  thinkingLabel,
  youLabel,
  assistantLabel,
  openStayLabel,
  onOpenStay,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const last = messages.at(-1);

  const onScroll = (): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stickToBottom.current = distance < STICK_TO_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !stickToBottom.current) return;
    const newest = last
      ? scroller.querySelector<HTMLElement>(`[data-message-id="${last.id}"]`)
      : null;
    if (last?.role === 'assistant' && newest && !thinking) {
      // Show the reply from its start; if it is short this is the same as the bottom. The
      // scroller is positioned, so offsetTop is measured from its own top.
      const top = newest.offsetTop - 12;
      scroller.scrollTop = Math.min(top, scroller.scrollHeight - scroller.clientHeight);
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [last, thinking]);

  // A newly sent guest message always brings the view down to it.
  useEffect(() => {
    if (last?.role === 'user') stickToBottom.current = true;
  }, [last]);

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="relative min-h-[200px] flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
    >
      <ul
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="m-0 flex list-none flex-col gap-3 p-0"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            youLabel={youLabel}
            assistantLabel={assistantLabel}
            openStayLabel={openStayLabel}
            onOpenStay={onOpenStay}
          />
        ))}
        {thinking && <ThinkingDots label={thinkingLabel} />}
      </ul>
    </div>
  );
};

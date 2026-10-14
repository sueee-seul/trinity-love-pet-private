import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { PortalIllustration as Illustration } from '../../components/illustrations/PortalIllustration';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';
import { useAiChatStore } from '../store';
import type { Conversation } from '../types';
import { formatDayLabel, formatTime } from '../utils';
import { MessageBubble } from './MessageBubble';

const OUTLINE_BUTTON =
  'type-button inline-flex min-h-11 items-center rounded-full border border-control-border px-4 transition-colors md:min-h-9 md:px-3';
// Sent to the chat as the parent's message, so it stays in the English the assistant reads.
const NEW_CONVERSATION_QUICK_REPLIES = ['Check my pet status.'];

function AiThinkingIndicator(): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  return (
    <div className="flex flex-col items-start">
      <div
        className="flex max-w-[80%] items-center gap-1 rounded-2xl rounded-bl-[4px] border border-border-soft bg-surface-card px-4 py-3"
        aria-live="polite"
        aria-label={copy.aiThinkingLabel}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-notice-muted motion-safe:animate-bounce motion-safe:[animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-notice-muted motion-safe:animate-bounce motion-safe:[animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-notice-muted motion-safe:animate-bounce" />
      </div>
      <span className="type-meta mt-1">{copy.aiThinkingText}</span>
    </div>
  );
}

function ConversationAvatar({ isSupport }: { isSupport: boolean }): ReactElement {
  if (!isSupport)
    return (
      <Illustration
        name="assistant"
        caption={false}
        imageClassName="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  return (
    <div
      aria-hidden="true"
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
        isSupport
          ? 'bg-status-success/15 text-status-success'
          : 'bg-surface-bubbles text-accent-foreground'
      }`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            isSupport
              ? 'M3 18v-6a9 9 0 1118 0v6a3 3 0 01-3 3h-1a2 2 0 01-2-2v-3a2 2 0 012-2h4M3 18a3 3 0 003 3h1a2 2 0 002-2v-3a2 2 0 00-2-2H3'
              : 'M12 3v4m0 10v4m9-9h-4M7 12H3m14.657-6.657l-2.829 2.829M9.172 14.828l-2.829 2.829m0-11.314l2.829 2.829m5.656 5.656l2.829 2.829'
          }
        />
      </svg>
    </div>
  );
}

function BackToListButton({ onBack }: { onBack: () => void }): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={copy.backToConversations}
      className="-ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-notice-secondary transition-colors hover:bg-surface-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
    </button>
  );
}

interface ConversationAreaProps {
  conversation: Conversation | null;
  variant: 'panel' | 'page';
  onSendMessage: (body: string) => void;
  onRequestSupport: () => void;
  onCloseConversation: () => void;
  /** Phones show the list or one conversation at a time; this leads back to the list. */
  onBack?: () => void;
}

export function ConversationArea({
  conversation,
  variant,
  onSendMessage,
  onRequestSupport,
  onCloseConversation,
  onBack,
}: ConversationAreaProps): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const locale = usePortalLocale();
  const [draft, setDraft] = useState('');
  const streamEndRef = useRef<HTMLDivElement>(null);
  const isReadOnly = conversation?.status === 'Closed';
  const parentName = useAiChatStore((state) => state.parentName);
  const isAiThinking = useAiChatStore((state) =>
    conversation ? Boolean(state.awaitingAiReply[conversation.id]) : false,
  );

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation?.messages.length, isAiThinking]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="type-body m-0 text-notice-muted">{copy.noConversation}</p>
      </div>
    );
  }

  // A form, so Enter and the send key on a phone keyboard both submit the message.
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isReadOnly || !draft.trim()) {
      return;
    }
    onSendMessage(draft);
    setDraft('');
  };

  const startedDay = formatDayLabel(conversation.startedAt, locale);
  const startedTime = formatTime(conversation.startedAt, locale);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
        {onBack && <BackToListButton onBack={onBack} />}
        <ConversationAvatar isSupport={conversation.supportStatus === 'Support Handling'} />
        <div className="min-w-0">
          <h2 className="type-card-title m-0 truncate font-normal">{copy.topic(conversation)}</h2>
          <p className="type-meta m-0 truncate">
            {copy.startedAt(startedDay, startedTime)}
            {conversation.petName ? ` · ${conversation.petName}` : ''}
          </p>
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex flex-wrap justify-end gap-2 border-b border-border-soft px-4 py-2">
          {conversation.supportStatus === 'AI Handling' && (
            <button
              type="button"
              onClick={onRequestSupport}
              className={`${OUTLINE_BUTTON} text-accent-foreground hover:bg-surface-bubbles`}
            >
              {copy.contactSupport}
            </button>
          )}
          <button
            type="button"
            onClick={onCloseConversation}
            className={`${OUTLINE_BUTTON} text-notice-secondary hover:bg-surface-cream`}
          >
            {copy.closeConversation}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-surface-cream px-4 py-4">
        <div className="flex justify-center pb-1">
          <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-surface-deep px-3 py-1 text-notice-secondary">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {copy.dayAndTime(startedDay, startedTime)}
          </span>
        </div>
        {conversation.messages.length === 0 ? (
          <MessageBubble
            message={{
              id: `welcome-${conversation.id}`,
              senderRole: 'ai',
              body: copy.welcome(parentName),
              timestamp: conversation.startedAt,
              quickReplies: NEW_CONVERSATION_QUICK_REPLIES,
            }}
            onSelectQuickReply={!isReadOnly ? onSendMessage : undefined}
          />
        ) : (
          conversation.messages.map((message, index) => {
            const isLatestAiMessage =
              index === conversation.messages.length - 1 &&
              message.senderRole === 'ai' &&
              !isAiThinking &&
              conversation.supportStatus === 'AI Handling';
            return (
              <MessageBubble
                key={message.id}
                message={message}
                onSelectQuickReply={isLatestAiMessage && !isReadOnly ? onSendMessage : undefined}
              />
            );
          })
        )}
        {isAiThinking && <AiThinkingIndicator />}
        <div ref={streamEndRef} />
      </div>

      {isReadOnly ? (
        <p className="type-meta m-0 border-t border-border-soft px-4 py-3 text-center">
          {copy.closedReadOnly}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-border-soft px-4 py-3">
          <div className="flex items-center gap-2">
            {/* White with a visible edge: the muted placeholder is 5.2:1 here, 4.45:1 on a tint. */}
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={copy.messageLabel}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={variant === 'page' ? copy.pagePlaceholder : copy.panelPlaceholder}
              className="type-body min-h-11 min-w-0 flex-1 rounded-full border border-field-border bg-surface-card px-4 placeholder:text-notice-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <button
              type="submit"
              aria-label={copy.sendMessage}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-action-dark theme-gradient-action text-on-action-dark transition-colors hover:bg-action-dark-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
              </svg>
            </button>
          </div>
          {variant === 'page' && <p className="type-meta m-0 mt-2">{copy.pageFootnote}</p>}
        </form>
      )}
    </div>
  );
}

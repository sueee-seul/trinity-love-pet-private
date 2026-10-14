import type { ReactElement } from 'react';
import { ChatMarkdown } from '../../../../shared/components/ui/ChatMarkdown';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';
import { aiReplyText, quickReplyText } from '../chatServerWords';
import type { Message } from '../types';
import { formatTime } from '../utils';
import { PetOverviewCards } from './PetOverviewCards';

interface MessageBubbleProps {
  message: Message;
  onSelectQuickReply?: (reply: string) => void;
}

export function MessageBubble({ message, onSelectQuickReply }: MessageBubbleProps): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const locale = usePortalLocale();
  const time = formatTime(message.timestamp, locale);

  if (message.senderRole === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="max-w-full rounded-full bg-surface-deep px-3 py-1 text-center type-meta text-notice-secondary break-words">
          {copy.systemNotice(message.body)} · {time}
        </span>
      </div>
    );
  }

  if (message.senderRole === 'pet_owner') {
    return (
      <div className="flex flex-col items-end">
        {/* A tapped quick reply was sent in the server's words; it reads in the parent's. */}
        <div className="max-w-[80%] rounded-2xl rounded-br-[4px] bg-action-dark px-4 py-2.5 type-body text-on-action-dark break-words">
          {quickReplyText(message.body, locale)}
        </div>
        <span className="mt-1 type-meta text-notice-muted">{time}</span>
      </div>
    );
  }

  const supportRoleLabel = message.authorIsManager ? copy.managerRole : copy.supportRole;
  const senderLabel =
    message.senderRole === 'support'
      ? message.authorName
        ? copy.supportSender(message.authorName, supportRoleLabel)
        : supportRoleLabel
      : copy.assistantName;

  return (
    <div className="flex flex-col items-start">
      {message.petCards?.length ? (
        <>
          <p className="mb-2 type-body text-notice-primary">
            {message.petCards.length === 1
              ? copy.petCardsIntroOne(message.petCards[0]?.profile.name ?? '')
              : message.petCards.every((card) => Boolean(card.answer))
                ? copy.petAnswersIntroMany
                : copy.petCardsIntroMany}
          </p>
          <PetOverviewCards pets={message.petCards} />
        </>
      ) : (
        <div
          className={`max-w-[80%] rounded-2xl rounded-bl-[4px] border border-border-soft bg-surface-card px-4 py-2.5 type-body text-notice-primary break-words ${
            message.senderRole === 'ai' ? '' : 'whitespace-pre-wrap'
          }`}
        >
          {/* The assistant may use light Markdown; a person on the team is shown as they typed. */}
          {message.senderRole === 'ai' ? (
            <ChatMarkdown text={aiReplyText(message.body, locale)} />
          ) : (
            message.body
          )}
        </div>
      )}
      {message.senderRole === 'ai' && onSelectQuickReply && message.quickReplies && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label={copy.suggestedOptions}>
          {message.quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => onSelectQuickReply(reply)}
              className="rounded-full border border-control-border bg-surface-card px-3 py-1.5 type-button text-accent-foreground transition-colors hover:bg-apricot-cream-100"
            >
              {quickReplyText(reply, locale)}
            </button>
          ))}
        </div>
      )}
      <span className="mt-1 type-meta text-notice-muted">
        {senderLabel} · {time}
      </span>
    </div>
  );
}

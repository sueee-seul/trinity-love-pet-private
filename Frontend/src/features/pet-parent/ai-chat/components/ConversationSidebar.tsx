import type { ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { CHAT_COPY, type ChatCopy } from '../chatCopy';
import type { Conversation, ConversationTopicCategory } from '../types';
import { formatDayLabel } from '../utils';

interface ConversationSidebarProps {
  current: Conversation | null;
  past: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartNew: () => void;
}

const TOPIC_ICON_PATHS: Record<ConversationTopicCategory, string> = {
  Feeding: 'M12 3c-3 3-5 5.5-5 8.5A5 5 0 0012 17a5 5 0 005-5.5C17 8.5 15 6 12 3z',
  Booking: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  Medication: 'M9 3h6a1 1 0 011 1v5H8V4a1 1 0 011-1zM8 9h8v9a3 3 0 01-3 3h-2a3 3 0 01-3-3V9z',
  General:
    'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
};

function TopicIcon({
  category,
  tone,
}: {
  category: ConversationTopicCategory;
  tone: string;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={TOPIC_ICON_PATHS[category]} />
      </svg>
    </span>
  );
}

// Muted text is only 4.15:1 on the `surface-bubbles` of a selected card, so meta lines there use
// the secondary ink (6.75:1).
const META_ON_TINT = 'text-notice-secondary';

// The status is always written out; the dot beside it only repeats it.
function supportStatusOf(
  conversation: Conversation,
  copy: ChatCopy,
): { label: string; dot: string } {
  switch (conversation.supportStatus) {
    case 'Support Handling':
      return { label: copy.withSupport(conversation.supportAgentName), dot: 'bg-status-success' };
    case 'Support Requested':
    case 'Support Assigned':
      return { label: copy.supportRequested, dot: 'bg-status-warning' };
    default:
      return { label: copy.assistantName, dot: 'bg-accent-foreground' };
  }
}

function CurrentConversationCard({
  current,
  isSelected,
  onSelect,
}: {
  current: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const status = supportStatusOf(current, copy);
  return (
    <button
      type="button"
      onClick={() => onSelect(current.id)}
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
        isSelected
          ? 'border-control-border bg-surface-bubbles'
          : 'border-border-soft bg-surface-bubbles/60 hover:bg-surface-bubbles'
      }`}
    >
      <span className="flex items-start gap-3">
        <TopicIcon category={current.topicCategory} tone="bg-surface-card text-accent-foreground" />
        <span className="min-w-0 flex-1">
          <span className="type-body block truncate font-bold">{copy.topic(current)}</span>
          <span className={`type-meta mt-1 flex items-center gap-1.5 ${META_ON_TINT}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${status.dot}`}
            />
            <span className="truncate">{status.label}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function PastConversationRow({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const locale = usePortalLocale();
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={isSelected ? 'true' : undefined}
      className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
        isSelected ? 'bg-surface-bubbles' : 'hover:bg-surface-cream'
      }`}
    >
      <TopicIcon category={conversation.topicCategory} tone="bg-surface-deep text-notice-muted" />
      <span className="min-w-0 flex-1">
        <span className="type-body block truncate font-bold">{copy.topic(conversation)}</span>
        <span className={`type-meta block truncate ${isSelected ? META_ON_TINT : ''}`}>
          {conversation.petName ?? copy.generalSubject} ·{' '}
          {formatDayLabel(conversation.startedAt, locale)}
        </span>
      </span>
      <svg
        className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-notice-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
        />
      </svg>
    </button>
  );
}

export function ConversationSidebar({
  current,
  past,
  selectedId,
  onSelect,
  onStartNew,
}: ConversationSidebarProps): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  return (
    <div className="flex h-full w-full flex-col bg-surface-card md:w-[300px] md:flex-shrink-0 md:border-r md:border-border-soft">
      <div className="border-b border-border-soft px-4 py-3">
        {/* The page's one h1: the chat tool has no separate page title above it. */}
        <h1 className="type-card-title m-0 font-normal">{copy.conversations}</h1>
      </div>

      <div className="border-b border-border-soft p-4">
        <button
          type="button"
          disabled={Boolean(current)}
          onClick={onStartNew}
          className="type-button flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-control-border px-3 text-notice-secondary transition-colors enabled:hover:bg-surface-bubbles enabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:text-notice-muted disabled:opacity-60"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {copy.newConversation}
        </button>
        {current && <p className="type-meta m-0 mt-2">{copy.closeCurrentFirst}</p>}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {current && (
          <div className="p-4">
            <h2 className="type-eyebrow m-0 mb-2 text-notice-muted">{copy.currentHeading}</h2>
            <CurrentConversationCard
              current={current}
              isSelected={selectedId === current.id}
              onSelect={onSelect}
            />
          </div>
        )}

        <div className={current ? 'p-4 pt-0' : 'p-4'}>
          <h2 className="type-eyebrow m-0 mb-2 text-notice-muted">{copy.pastHeading}</h2>
          {past.length === 0 ? (
            <p className="type-meta m-0">{copy.noPastConversations}</p>
          ) : (
            <ul className="space-y-1.5">
              {past.map((conversation) => (
                <li key={conversation.id}>
                  <PastConversationRow
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-border-soft p-4">
        <p className="type-meta m-0">{copy.sidebarFootnote}</p>
      </div>
    </div>
  );
}

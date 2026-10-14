import { useState, type ReactElement } from 'react';
import type { InquiryMessage } from '../../../types/inquiry';
import { formatInquiryTime } from '../../../utils/inquiryTime';

interface ConversationHistoryCardProps {
  messages: InquiryMessage[];
}

const COLLAPSED_COUNT = 4;

function senderLabel(message: InquiryMessage): string {
  if (message.senderRole === 'pet_owner') return 'Pet Parent';
  if (message.senderRole === 'ai') return 'AI Assistant';
  if (message.senderRole === 'staff') {
    const name = message.authorName ?? 'Customer Support';
    const roleLabel = message.authorRole === 'manager' ? 'Manager' : 'Staff';
    return `${name} (${roleLabel})`;
  }
  return 'System';
}

function senderInitial(message: InquiryMessage): string {
  return senderLabel(message).charAt(0);
}

/**
 * Warm for the pet parent, neutral for the AI, green for regular staff and
 * amber for a manager, so the eye can tell them apart while scanning. It is the
 * same green/amber pairing `SupportStatusBadge` already uses for
 * "Handling"/"Requested". Both use a stronger tint than that badge's `/10`:
 * a badge leans on colored *text* for contrast, but this is a filled
 * paragraph block with no colored text, so `/10` over the white card was
 * next to invisible.
 */
function senderBubbleClass(message: InquiryMessage): string {
  if (message.senderRole === 'pet_owner') return 'bg-apricot-cream-100 text-notice-primary';
  if (message.senderRole === 'staff') {
    return message.authorRole === 'manager'
      ? 'bg-status-warning/20 text-notice-primary'
      : 'bg-status-success/20 text-notice-primary';
  }
  return 'bg-surface-deep text-notice-primary';
}

export function ConversationHistoryCard({ messages }: ConversationHistoryCardProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const visibleMessages = expanded ? messages : messages.slice(-COLLAPSED_COUNT);

  return (
    <div className="flex flex-col rounded-2xl border border-border-soft bg-surface-card p-4">
      <div className="mb-2 flex flex-shrink-0 items-center justify-between">
        <h3 className="type-card-title">Conversation History</h3>
        {messages.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="type-meta font-bold text-accent-foreground hover:text-accent-foreground-hover"
          >
            {expanded ? 'Show less' : 'View all'}
          </button>
        )}
      </div>

      <div className="max-h-[320px] space-y-3 overflow-y-auto">
        {visibleMessages.map((message) => {
          if (message.senderRole === 'system') {
            const isEscalation = message.body.toLowerCase().includes('requested');
            return (
              <div key={message.id} className="flex justify-center">
                <span
                  className={`rounded-full px-3 py-1 type-meta font-bold ${
                    isEscalation
                      ? 'bg-status-warning/10 text-accent-foreground'
                      : 'bg-surface-deep text-notice-muted'
                  }`}
                >
                  {message.body} · {formatInquiryTime(message.timestamp)}
                </span>
              </div>
            );
          }

          return (
            <div key={message.id} className="flex items-start gap-2.5">
              <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-apricot-cream-100 type-meta font-bold text-accent-foreground">
                {senderInitial(message)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-meta text-notice-muted">
                  {senderLabel(message)} · {formatInquiryTime(message.timestamp)}
                </p>
                <p
                  className={`mt-0.5 rounded-lg px-3 py-2 type-body ${senderBubbleClass(message)}`}
                >
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

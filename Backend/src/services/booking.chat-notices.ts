import type { ParentBookingNotificationKind } from '../contracts/booking.notification.contract.js';
import type { ParentNoticeDraft } from '../repositories/booking.notification.repository.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as messageRepository from '../repositories/message.repository.js';
import { noticeTitle } from './booking.notification.messages.js';
import { publishConversationEvent, publishInquiryCreated } from './conversation.events.js';

// The request and the manager's answer also go into the parent's Booking enquiry chat, so the
// thread where they asked tells them what happened (owner decision 2026-10-14). The bell keeps its
// own copy. A chat line is a courtesy like the bell: a failure is logged and never undoes or
// blocks the request or the decision.

/** Topic of these messages, so the chat pipeline can tell them from its own answers. */
export const BOOKING_STATUS_TOPIC = 'booking_status';

const CHAT_KINDS: ReadonlySet<ParentBookingNotificationKind> = new Set([
  'booking_request_received',
  'booking_approved',
  'booking_refused',
  'booking_change_requested',
  'booking_change_approved',
  'booking_change_refused',
]);

/** The parent's open conversation, or a new one when they have none open. */
const openConversationOf = async (
  ownerId: string,
): Promise<conversationRepository.ConversationRecord> => {
  const conversations = await conversationRepository.findConversationsByOwner(ownerId);
  const open = conversations.find(
    (conversation) => conversation.status === 'active' || conversation.status === 'handed_off',
  );
  if (open) return open;
  const created = await conversationRepository.createConversation(ownerId);
  publishInquiryCreated(created._id.toString());
  return created;
};

/** Posts a booking notice into the parent's chat as an assistant message. Never throws. */
export const postBookingNoticeToChat = async (notice: ParentNoticeDraft | null): Promise<void> => {
  if (!notice || !CHAT_KINDS.has(notice.kind)) return;
  try {
    const conversation = await openConversationOf(notice.ownerId);
    const conversationId = conversation._id.toString();
    await messageRepository.createAiMessage({
      conversationId,
      body: `${noticeTitle(notice.kind, 'en')}: ${notice.body}`,
      topic: BOOKING_STATUS_TOPIC,
      petUuid: null,
      bookingPetsUuid: null,
      intent: 'qa',
      outcome: 'clear',
      comparedPetsUuids: null,
      resolverMetadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: null,
      },
    });
    await conversationRepository.touchConversation(conversationId);
    publishConversationEvent(conversationId);
  } catch (error: unknown) {
    // Ids and the error name only: the notice text holds pet names and a refusal reason.
    console.error('[notifications] booking chat notice was not written', {
      kind: notice.kind,
      bookingId: notice.bookingId,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
};

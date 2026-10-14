import { AppError } from '../common/middlewares/error.middleware.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as messageRepository from '../repositories/message.repository.js';
import { publishConversationEvent, publishInquiryCreated } from './conversation.events.js';
import { generateAiTurn } from './conversation.ai.service.js';
import { runStayChangeTurn } from './conversation.stay-changes.js';
import type { ChatReplyLanguage } from './conversation.resolver.js';
import type { ConversationRecord } from '../repositories/conversation.repository.js';
import type { MessageRecord } from '../repositories/message.repository.js';
import type {
  ConversationDto,
  ConversationMessageDto,
} from '../contracts/conversation.contract.js';

const forbidden = (): AppError =>
  new AppError('You do not have permission to access this conversation', 'FORBIDDEN', 403);

const notFound = (): AppError => new AppError('Conversation not found', 'NOT_FOUND', 404);

/** The topic of the chat's own replies about changing a stay. */
const STAY_CHANGE_TOPIC = 'stay_change';

export const toMessageDto = (message: MessageRecord): ConversationMessageDto => ({
  uuid: message._id.toString(),
  conversations_uuid: message.conversations_uuid,
  created_at: message.created_at.toISOString(),
  sender_role: message.sender_role,
  topic: message.topic,
  body: message.body,
  employees_uuid: message.employees_uuid,
  employees_display_name: message.employees_display_name,
  pets_uuid: message.pets_uuid,
  booking_pets_uuid: message.booking_pets_uuid,
  ...(message.sender_role === 'ai' &&
  message.outcome === 'ambiguous' &&
  message.resolver_metadata.candidates?.length
    ? { quick_replies: message.resolver_metadata.candidates }
    : message.sender_role === 'ai' && message.resolver_metadata.action_replies?.length
      ? { quick_replies: message.resolver_metadata.action_replies }
      : {}),
  ...(message.sender_role === 'ai' && message.resolver_metadata.pet_cards?.length
    ? { pet_cards: message.resolver_metadata.pet_cards }
    : {}),
});

const toConversationDto = (
  conversation: ConversationRecord,
  messages: MessageRecord[],
): ConversationDto => ({
  uuid: conversation._id.toString(),
  pet_owners_uuid: conversation.pet_owners_uuid,
  status: conversation.status,
  created_at: conversation.created_at.toISOString(),
  updated_at: conversation.updated_at.toISOString(),
  current_entity: conversation.current_entity,
  assigned_staff_uuid: conversation.assigned_staff_uuid,
  ai_summary: conversation.ai_summary,
  employee_notes: conversation.employee_notes,
  support_status: conversation.support_status,
  messages: messages.map(toMessageDto),
});

export const listConversationsForOwner = async (ownerUuid: string): Promise<ConversationDto[]> => {
  const conversations = await conversationRepository.findConversationsByOwner(ownerUuid);
  if (conversations.length === 0) {
    return [];
  }

  const conversationIds = conversations.map((conversation) => conversation._id.toString());
  const messages = await messageRepository.findMessagesByConversations(conversationIds);
  const messagesByConversation = new Map<string, MessageRecord[]>();
  for (const message of messages) {
    const existing = messagesByConversation.get(message.conversations_uuid) ?? [];
    existing.push(message);
    messagesByConversation.set(message.conversations_uuid, existing);
  }

  return conversations.map((conversation) =>
    toConversationDto(conversation, messagesByConversation.get(conversation._id.toString()) ?? []),
  );
};

export const getConversationForOwner = async (
  conversationId: string,
  ownerUuid: string,
): Promise<ConversationDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }
  if (conversation.pet_owners_uuid !== ownerUuid) {
    throw forbidden();
  }

  const messages = await messageRepository.findMessagesByConversation(conversationId);
  return toConversationDto(conversation, messages);
};

/** Same ownership check as the other pet-owner endpoints, without fetching messages - used to gate the SSE stream before it opens. */
export const assertOwnedConversation = async (
  conversationId: string,
  ownerUuid: string,
): Promise<void> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }
  if (conversation.pet_owners_uuid !== ownerUuid) {
    throw forbidden();
  }
};

export const startConversation = async (ownerUuid: string): Promise<ConversationDto> => {
  const conversation = await conversationRepository.createConversation(ownerUuid);
  publishInquiryCreated(conversation._id.toString());
  return toConversationDto(conversation, []);
};

/**
 * A change to the stay is handled before the question-answering pipeline: it moves money, so it is
 * read, priced and confirmed by code (conversation.stay-changes.ts), never by the model. True when
 * this turn was about a stay change and its reply is saved. Any other message drops a change that
 * was waiting for a yes, so an old quote can never be confirmed by a later, unrelated "ok".
 */
const answerStayChange = async (
  conversationId: string,
  ownerUuid: string,
  conversation: ConversationRecord,
  userMessage: string,
  replyLanguage: ChatReplyLanguage,
): Promise<boolean> => {
  const pending = conversation.pending_stay_change ?? null;
  const turn = await runStayChangeTurn(
    { ownerId: ownerUuid, userMessage, language: replyLanguage, pending },
    {
      claimPending: () =>
        pending
          ? conversationRepository.claimPendingStayChange(conversationId, pending.created_at)
          : Promise.resolve(false),
    },
  );
  if (!turn) {
    if (pending) await conversationRepository.setPendingStayChange(conversationId, null);
    return false;
  }
  await messageRepository.createAiMessage({
    conversationId,
    body: turn.reply,
    topic: STAY_CHANGE_TOPIC,
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
      action_replies: turn.quickReplies,
    },
  });
  await conversationRepository.setPendingStayChange(conversationId, turn.pending);
  publishConversationEvent(conversationId);
  return true;
};

/**
 * Runs the resolver/guardrail/retrieval/answer pipeline and persists the
 * `ai` reply, fired off without blocking the pet owner's own POST response
 * (an LLM round trip - here, two of them - is too slow to hold the request
 * open for). Errors are caught and logged rather than rethrown since there
 * is no caller left to receive them; the pet owner's message is already
 * safely persisted regardless of whether the AI reply succeeds.
 */
const runAiReplyPipeline = async (
  conversationId: string,
  ownerUuid: string,
  conversationBeforeThisTurn: ConversationRecord,
  userMessage: string,
  replyLanguage: ChatReplyLanguage,
): Promise<void> => {
  try {
    if (
      await answerStayChange(
        conversationId,
        ownerUuid,
        conversationBeforeThisTurn,
        userMessage,
        replyLanguage,
      )
    ) {
      return;
    }
    const result = await generateAiTurn({
      ownerUuid,
      conversationId,
      state: {
        current_entity: conversationBeforeThisTurn.current_entity,
        pending: conversationBeforeThisTurn.pending,
        referenced_pets_uuids: conversationBeforeThisTurn.referenced_pets_uuids,
        recent_topics: conversationBeforeThisTurn.recent_topics,
      },
      userMessage,
      replyLanguage,
    });

    await messageRepository.createAiMessage({
      conversationId,
      body: result.replyBody,
      topic: result.topic,
      petUuid: result.petUuid,
      bookingPetsUuid: result.bookingPetUuid,
      intent: result.intent,
      outcome: result.outcome,
      comparedPetsUuids: result.comparedPetsUuids,
      resolverMetadata: {
        ...result.resolverMetadata,
        pet_cards: result.resolverMetadata.pet_cards ?? null,
      },
    });
    await conversationRepository.updateConversationState(conversationId, result.state);
    publishConversationEvent(conversationId);
  } catch (error: unknown) {
    console.error(
      '[conversation] AI reply generation failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    try {
      await messageRepository.createAiMessage({
        conversationId,
        body: "I couldn't complete that response just now. Please try again, or contact Customer Support.",
        topic: null,
        petUuid: null,
        bookingPetsUuid: null,
        intent: 'qa',
        outcome: 'unsupported',
        comparedPetsUuids: null,
        resolverMetadata: {
          candidates: null,
          invalid_name: null,
          booking_hint: null,
          pet_cards: null,
        },
      });
      publishConversationEvent(conversationId);
    } catch (fallbackError: unknown) {
      console.error(
        '[conversation] Failed to persist AI fallback reply',
        fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
      );
    }
  }
};

export const postPetOwnerMessage = async (
  conversationId: string,
  ownerUuid: string,
  body: string,
  replyLanguage: ChatReplyLanguage = 'en',
): Promise<ConversationMessageDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }
  if (conversation.pet_owners_uuid !== ownerUuid) {
    throw forbidden();
  }

  const message = await messageRepository.createPetOwnerMessage({
    conversationId,
    body,
    petUuid: conversation.current_entity?.pet_uuid ?? null,
    bookingPetsUuid: conversation.current_entity?.booking_pets_uuid ?? null,
  });
  await conversationRepository.touchConversation(conversationId);
  publishConversationEvent(conversationId);

  // The AI shouldn't talk over a live agent, and a closed conversation
  // shouldn't get replies at all.
  if (conversation.status === 'active' && conversation.support_status === 'ai_handling') {
    void runAiReplyPipeline(conversationId, ownerUuid, conversation, body, replyLanguage);
  }

  return toMessageDto(message);
};

export const closeConversation = async (
  conversationId: string,
  ownerUuid: string,
): Promise<ConversationDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }
  if (conversation.pet_owners_uuid !== ownerUuid) {
    throw forbidden();
  }

  const ended = await conversationRepository.endConversation(conversationId);
  if (!ended) {
    throw notFound();
  }

  const messages = await messageRepository.findMessagesByConversation(conversationId);
  return toConversationDto(ended, messages);
};

export const requestSupport = async (
  conversationId: string,
  ownerUuid: string,
): Promise<ConversationDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }
  if (conversation.pet_owners_uuid !== ownerUuid) {
    throw forbidden();
  }

  const updated = await conversationRepository.setSupportStatus(
    conversationId,
    'support_requested',
  );
  if (!updated) {
    throw notFound();
  }

  const messages = await messageRepository.findMessagesByConversation(conversationId);
  return toConversationDto(updated, messages);
};

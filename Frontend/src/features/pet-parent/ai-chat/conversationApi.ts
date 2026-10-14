import { API_BASE_URL } from '../../../shared/api';
import { topicFor } from './conversationText';
import type {
  Conversation,
  ConversationTopicCategory,
  Message,
  MessageSenderRole,
  PetOverviewCard,
} from './types';
import { currentPortalLocale, type PortalLocale } from '../i18n/portalLocale';

const BASE_URL = `${API_BASE_URL}/petparent/conversations`;

type ApiConversationStatus = 'active' | 'ended' | 'resolved' | 'handed_off';
type ApiSupportStatus =
  'ai_handling' | 'support_requested' | 'support_assigned' | 'support_handling' | 'resolved';
type ApiMessageSenderRole = 'pet_owner' | 'ai' | 'staff' | 'manager';

interface ApiMessage {
  uuid: string;
  conversations_uuid: string;
  created_at: string;
  sender_role: ApiMessageSenderRole;
  topic: string | null;
  body: string;
  employees_uuid: string | null;
  employees_display_name: string | null;
  pets_uuid: string | null;
  booking_pets_uuid: string | null;
  quick_replies?: string[];
  pet_cards?: PetOverviewCard[];
}

interface ApiConversation {
  uuid: string;
  pet_owners_uuid: string;
  status: ApiConversationStatus;
  created_at: string;
  updated_at: string;
  current_entity: { pet_uuid: string; booking_pets_uuid: string } | null;
  support_status: ApiSupportStatus;
  messages: ApiMessage[];
}

export class ConversationApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ConversationApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const messageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Empty or non-JSON body; the fallback is the best message available.
  }
  return fallback;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const senderRoleFrom = (role: ApiMessageSenderRole): MessageSenderRole =>
  role === 'staff' || role === 'manager' ? 'support' : role;

const categoryFrom = (topic: string | null): ConversationTopicCategory => {
  if (!topic) {
    return 'General';
  }
  const normalised = topic.toLowerCase();
  if (normalised.includes('feed')) return 'Feeding';
  if (normalised.includes('med')) return 'Medication';
  if (normalised.includes('book') || normalised.includes('stay')) return 'Booking';
  return 'General';
};

const mapMessage = (message: ApiMessage): Message => {
  const isEmployeeMessage = message.sender_role === 'staff' || message.sender_role === 'manager';
  return {
    id: message.uuid,
    senderRole: senderRoleFrom(message.sender_role),
    body: message.body,
    timestamp: message.created_at,
    ...(message.quick_replies?.length ? { quickReplies: message.quick_replies } : {}),
    ...(message.pet_cards?.length ? { petCards: message.pet_cards } : {}),
    ...(isEmployeeMessage && message.employees_display_name
      ? { authorName: message.employees_display_name }
      : {}),
    ...(isEmployeeMessage ? { authorIsManager: message.sender_role === 'manager' } : {}),
  };
};

const SUPPORT_STATUS_FROM_API: Record<ApiSupportStatus, Conversation['supportStatus']> = {
  ai_handling: 'AI Handling',
  support_requested: 'Support Requested',
  support_assigned: 'Support Assigned',
  support_handling: 'Support Handling',
  resolved: 'Resolved',
};

export const mapConversation = (
  conversation: ApiConversation,
  petNamesByUuid: ReadonlyMap<string, string>,
): Conversation => {
  const petUuid = conversation.current_entity?.pet_uuid ?? null;
  const petName = petUuid ? (petNamesByUuid.get(petUuid) ?? null) : null;
  const firstMessageTopic = conversation.messages.find((message) => message.topic)?.topic ?? null;
  const topicCategory = categoryFrom(firstMessageTopic);

  return {
    id: conversation.uuid,
    topic: topicFor(petName, topicCategory),
    topicCategory,
    petName,
    status:
      conversation.status === 'active' || conversation.status === 'handed_off'
        ? 'Active'
        : 'Closed',
    supportStatus: SUPPORT_STATUS_FROM_API[conversation.support_status],
    startedAt: conversation.created_at,
    messages: conversation.messages.map(mapMessage),
  };
};

const parseConversations = async (response: Response): Promise<ApiConversation[]> => {
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not load your conversations'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.conversations)) {
    throw new ConversationApiError('The server sent conversations it could not read', 500);
  }
  return payload.conversations as ApiConversation[];
};

export const fetchConversations = async (
  petNamesByUuid: ReadonlyMap<string, string>,
): Promise<Conversation[]> => {
  const response = await fetch(BASE_URL, { credentials: 'include' });
  const conversations = await parseConversations(response);
  return conversations.map((conversation) => mapConversation(conversation, petNamesByUuid));
};

export const fetchConversation = async (
  conversationId: string,
  petNamesByUuid: ReadonlyMap<string, string>,
): Promise<Conversation> => {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(conversationId)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not load the conversation'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.conversation)) {
    throw new ConversationApiError('The server sent a conversation it could not read', 500);
  }
  return mapConversation(payload.conversation as unknown as ApiConversation, petNamesByUuid);
};

export const createConversationOnServer = async (
  petNamesByUuid: ReadonlyMap<string, string>,
): Promise<Conversation> => {
  const response = await fetch(BASE_URL, jsonInit('POST'));
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not start a new conversation'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.conversation)) {
    throw new ConversationApiError('The server sent a conversation it could not read', 500);
  }
  return mapConversation(payload.conversation as unknown as ApiConversation, petNamesByUuid);
};

export const closeConversationOnServer = async (
  conversationId: string,
  petNamesByUuid: ReadonlyMap<string, string>,
): Promise<Conversation> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/close`,
    jsonInit('POST'),
  );
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not close the conversation'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.conversation)) {
    throw new ConversationApiError('The server sent a conversation it could not read', 500);
  }
  return mapConversation(payload.conversation as unknown as ApiConversation, petNamesByUuid);
};

export const requestSupportOnServer = async (
  conversationId: string,
  petNamesByUuid: ReadonlyMap<string, string>,
): Promise<Conversation> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/request-support`,
    jsonInit('POST'),
  );
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not request customer support'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.conversation)) {
    throw new ConversationApiError('The server sent a conversation it could not read', 500);
  }
  return mapConversation(payload.conversation as unknown as ApiConversation, petNamesByUuid);
};

/** `locale` is the language the parent reads; the AI replies in it. */
export const postMessageOnServer = async (
  conversationId: string,
  body: string,
  locale: PortalLocale = currentPortalLocale(),
): Promise<Message> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/messages`,
    jsonInit('POST', { body, locale }),
  );
  if (!response.ok) {
    throw new ConversationApiError(
      await messageFrom(response, 'Could not send your message'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.message)) {
    throw new ConversationApiError('The server sent a message it could not read', 500);
  }
  return mapMessage(payload.message as unknown as ApiMessage);
};

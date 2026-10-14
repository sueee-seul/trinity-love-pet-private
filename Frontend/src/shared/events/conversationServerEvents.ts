import { API_BASE_URL } from '../api';

export const CONVERSATION_UPDATED_EVENT = 'conversation-updated';

export interface ConversationServerEvent {
  type: typeof CONVERSATION_UPDATED_EVENT;
  conversationId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isConversationServerEvent = (value: unknown): value is ConversationServerEvent => {
  return (
    isRecord(value) &&
    value.type === CONVERSATION_UPDATED_EVENT &&
    typeof value.conversationId === 'string'
  );
};

export const buildPetParentConversationEventsUrl = (conversationId: string): string =>
  `${API_BASE_URL}/petparent/conversations/${encodeURIComponent(conversationId)}/stream`;

export const buildAdminInquiryEventsUrl = (conversationId: string): string =>
  `${API_BASE_URL}/admin/inquiries/${encodeURIComponent(conversationId)}/stream`;

export const buildAdminInquiryListEventsUrl = (): string =>
  `${API_BASE_URL}/admin/inquiries/stream`;

const parseEventData = (event: Event): unknown | null => {
  if (!('data' in event) || typeof event.data !== 'string') {
    return null;
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
};

/**
 * Subscribes to the live "something changed" signal for one conversation.
 * No message content travels over this stream - a matching event (or a
 * reconnect) just asks the caller to re-fetch over the normal REST endpoint,
 * mirroring `subscribeToGoogleReviewServerEvents`.
 */
export const subscribeToConversationServerEvents = (
  url: string,
  conversationId: string,
  onRefresh: () => void,
): (() => void) => {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
    return (): void => undefined;
  }

  const eventSource = new window.EventSource(url, { withCredentials: true });
  let hasOpened = false;

  const handleOpen = (): void => {
    if (hasOpened) {
      onRefresh();
    }
    hasOpened = true;
  };

  const handleEvent = (event: Event): void => {
    const parsedPayload = parseEventData(event);
    if (
      parsedPayload !== null &&
      isConversationServerEvent(parsedPayload) &&
      parsedPayload.conversationId === conversationId
    ) {
      onRefresh();
    }
  };

  eventSource.addEventListener('open', handleOpen);
  eventSource.addEventListener(CONVERSATION_UPDATED_EVENT, handleEvent);

  return (): void => {
    eventSource.removeEventListener('open', handleOpen);
    eventSource.removeEventListener(CONVERSATION_UPDATED_EVENT, handleEvent);
    eventSource.close();
  };
};

export const INQUIRY_CREATED_EVENT = 'inquiry-created';

export interface InquiryCreatedServerEvent {
  type: typeof INQUIRY_CREATED_EVENT;
  conversationId: string;
}

const isInquiryCreatedServerEvent = (value: unknown): value is InquiryCreatedServerEvent => {
  return (
    isRecord(value) &&
    value.type === INQUIRY_CREATED_EVENT &&
    typeof value.conversationId === 'string'
  );
};

/**
 * Subscribes to "a new inquiry was created", broadcast to every employee with
 * the Inquiries list open. As with `subscribeToConversationServerEvents`, no
 * inquiry content travels over this stream - the caller re-fetches the new
 * conversation by id over the normal REST endpoint.
 */
export const subscribeToInquiryCreatedEvents = (
  onCreated: (conversationId: string) => void,
): (() => void) => {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
    return (): void => undefined;
  }

  const eventSource = new window.EventSource(buildAdminInquiryListEventsUrl(), {
    withCredentials: true,
  });

  const handleEvent = (event: Event): void => {
    const parsedPayload = parseEventData(event);
    if (parsedPayload !== null && isInquiryCreatedServerEvent(parsedPayload)) {
      onCreated(parsedPayload.conversationId);
    }
  };

  eventSource.addEventListener(INQUIRY_CREATED_EVENT, handleEvent);

  return (): void => {
    eventSource.removeEventListener(INQUIRY_CREATED_EVENT, handleEvent);
    eventSource.close();
  };
};

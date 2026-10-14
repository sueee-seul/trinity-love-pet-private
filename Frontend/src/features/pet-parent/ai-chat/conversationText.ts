import type { ConversationTopicCategory } from './types';

/*
 * The English words the chat itself writes into conversation state. They live here, apart from
 * the store and the API client, so the display copy (chatCopy.ts) can recognise them and show them
 * in the reader's language without changing what the state holds.
 */

/** The topic of a conversation the parent has opened but the server has not named yet. */
export const NEW_CONVERSATION_TOPIC = 'New conversation';

/** The system line added the moment the parent asks for a person. It never reaches the server. */
export const SUPPORT_REQUESTED_NOTICE = 'Customer Support requested';

/** The topic a conversation read from the server is given, from its pet and category. */
export const topicFor = (petName: string | null, category: ConversationTopicCategory): string =>
  petName ? `${petName} - ${category}` : `${category} enquiry`;

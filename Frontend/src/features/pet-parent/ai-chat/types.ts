export const CONVERSATION_STATUSES = ['Active', 'Closed'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const SUPPORT_STATUSES = [
  'AI Handling',
  'Support Requested',
  'Support Assigned',
  'Support Handling',
  'Resolved',
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export type MessageSenderRole = 'pet_owner' | 'ai' | 'support' | 'system';

export interface PetOverviewStay {
  stay: string;
  drop_off_time: string | null;
  pick_up_time: string | null;
  booking_status: string | null;
  care_information: {
    feeding_routine: string | null;
    medication_instructions: string | null;
    first_time_boarding: boolean | null;
    crate_trained: boolean | null;
    other_notes: string | null;
    allows_socialization: boolean | null;
    fully_vaccinated: boolean | null;
    behavior_and_health_notes: string | null;
  } | null;
  booked_services: Array<{ name: string; category: 'boarding_rate' | 'food' | 'addon' }>;
}

export interface PetOverviewCard {
  profile: {
    name: string;
    species: string;
    breed: string | null;
    age: number | null;
    weight: number | null;
    image_url?: string | null;
  };
  stays: PetOverviewStay[];
  answer?: string | null;
  event_photos?: Array<{ url: string; alt: string }>;
}

export interface Message {
  id: string;
  senderRole: MessageSenderRole;
  body: string;
  timestamp: string;
  quickReplies?: string[];
  petCards?: PetOverviewCard[];
  /** Display name for a support agent message, e.g. "John". */
  authorName?: string;
  /** Set only for a real `support` message. A manager's reply gets a different label than a regular staff member's. */
  authorIsManager?: boolean;
}

export type ConversationTopicCategory = 'Feeding' | 'Booking' | 'Medication' | 'General';

export interface Conversation {
  id: string;
  topic: string;
  topicCategory: ConversationTopicCategory;
  /** `null` for a general enquiry that isn't about a specific pet. */
  petName: string | null;
  status: ConversationStatus;
  supportStatus: SupportStatus;
  startedAt: string;
  supportRequestedAt?: string;
  supportAgentName?: string;
  messages: Message[];
}

import type { StaffRole } from './staff';

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

export const TOPIC_CATEGORIES = ['Feeding', 'Booking', 'Medication', 'General'] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export type InquiryMessageSenderRole = 'pet_owner' | 'ai' | 'staff' | 'system';

export interface InquiryMessage {
  id: string;
  senderRole: InquiryMessageSenderRole;
  body: string;
  timestamp: string;
  authorName?: string;
  /** Set only for `senderRole: 'staff'` - resolved from the staff directory, used to tell a manager's replies apart from other staff's. */
  authorRole?: StaffRole;
}

export interface InquiryAssignee {
  id: string;
  name: string;
}

export interface InquiryConversation {
  uuid: string;
  parentName: string;
  parentInitials: string;
  petName: string | null;
  topic: string;
  topicCategory: TopicCategory;
  startedAt: string;
  durationMinutes: number;
  status: ConversationStatus;
  supportStatus: SupportStatus;
  supportRequestedAt: string | null;
  assignee: InquiryAssignee | null;
  notes: string;
  aiSummary: string;
  aiDetectedTopic: string;
  aiEscalationReason: string | null;
  aiRelevantInfo: string;
  messages: InquiryMessage[];
}

export type InquiryTab = 'Active' | 'Closed';

export type InquirySupportStatusFilter = 'All' | SupportStatus;

export const isInquirySupportStatusFilter = (value: string): value is InquirySupportStatusFilter =>
  value === 'All' || SUPPORT_STATUSES.some((status) => status === value);

export const INQUIRY_NOTES_FILTERS = ['All', 'With notes', 'No notes'] as const;
export type InquiryNotesFilter = (typeof INQUIRY_NOTES_FILTERS)[number];

export const isInquiryNotesFilter = (value: string): value is InquiryNotesFilter =>
  INQUIRY_NOTES_FILTERS.some((filter) => filter === value);

export const INQUIRY_SORT_FIELDS = ['startedAt', 'durationMinutes'] as const;
export type InquirySortField = (typeof INQUIRY_SORT_FIELDS)[number];

export type InquirySortDirection = 'asc' | 'desc';

export interface InquirySort {
  field: InquirySortField;
  direction: InquirySortDirection;
}

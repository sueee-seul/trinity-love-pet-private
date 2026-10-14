import { API_BASE_URL } from '../../../shared/api';
import type {
  InquiryConversation,
  InquiryMessage,
  InquiryMessageSenderRole,
  SupportStatus,
  TopicCategory,
} from '../types/inquiry';
import type { StaffRole } from '../types/staff';

const BASE_URL = `${API_BASE_URL}/admin/inquiries`;

/** One staff member's display name and role, keyed by their employee uuid - enough to label a message's author and tell a manager's replies apart from other staff's. */
export interface StaffDirectoryEntry {
  name: string;
  role: StaffRole;
}

type ApiConversationStatus = 'active' | 'ended' | 'resolved' | 'handed_off';
type ApiSupportStatus =
  'ai_handling' | 'support_requested' | 'support_assigned' | 'support_handling' | 'resolved';
type ApiMessageSenderRole = 'pet_owner' | 'ai' | 'staff' | 'manager';

interface ApiMessage {
  uuid: string;
  created_at: string;
  sender_role: ApiMessageSenderRole;
  topic: string | null;
  body: string;
  employees_uuid: string | null;
  employees_display_name: string | null;
}

interface ApiInquiry {
  uuid: string;
  pet_owners_uuid: string;
  parent_first_name: string | null;
  parent_last_name: string | null;
  pet_uuid: string | null;
  pet_name: string | null;
  status: ApiConversationStatus;
  created_at: string;
  updated_at: string;
  assigned_staff_uuid: string | null;
  ai_summary: string | null;
  employee_notes: string | null;
  support_status: ApiSupportStatus;
  messages: ApiMessage[];
}

export class InquiryApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InquiryApiError';
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

const initialsFrom = (firstName: string | null, lastName: string | null): string => {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';
  return (first + last).toUpperCase() || '?';
};

const categoryFrom = (topic: string | null): TopicCategory => {
  if (!topic) {
    return 'General';
  }
  const normalised = topic.toLowerCase();
  if (normalised.includes('feed')) return 'Feeding';
  if (normalised.includes('med')) return 'Medication';
  if (normalised.includes('book') || normalised.includes('stay')) return 'Booking';
  return 'General';
};

/**
 * `handed_off` counts as still Active (a human is now on it), not Closed -
 * `ended` (pet owner closed it) and `resolved` (staff closed it) are both
 * terminal and look the same here; only the underlying `status` field tells
 * them apart.
 */
const statusFrom = (status: ApiConversationStatus): InquiryConversation['status'] =>
  status === 'ended' || status === 'resolved' ? 'Closed' : 'Active';

const SUPPORT_STATUS_FROM_API: Record<ApiSupportStatus, SupportStatus> = {
  ai_handling: 'AI Handling',
  support_requested: 'Support Requested',
  support_assigned: 'Support Assigned',
  support_handling: 'Support Handling',
  resolved: 'Resolved',
};

/** `manager` is still an employee-authored message for grouping purposes - `authorRole` (below) is what actually distinguishes it. */
const senderRoleFrom = (role: ApiMessageSenderRole): InquiryMessageSenderRole =>
  role === 'manager' ? 'staff' : role;

const mapMessage = (
  message: ApiMessage,
  staffDirectoryByUuid: ReadonlyMap<string, StaffDirectoryEntry>,
): InquiryMessage => {
  const isEmployeeMessage = message.sender_role === 'staff' || message.sender_role === 'manager';
  // The staff directory lookup is only a fallback for messages sent before
  // `sender_role: 'manager'`/`employees_display_name` existed - and it's
  // permission-gated (only a manager's session can fetch the full staff
  // list), so data stored directly on the message is what actually works
  // for every viewer.
  const author =
    isEmployeeMessage && message.employees_uuid
      ? staffDirectoryByUuid.get(message.employees_uuid)
      : undefined;
  const authorRole: StaffRole | undefined =
    message.sender_role === 'manager'
      ? 'manager'
      : message.sender_role === 'staff'
        ? (author?.role ?? 'staff')
        : undefined;

  return {
    id: message.uuid,
    senderRole: senderRoleFrom(message.sender_role),
    body: message.body,
    timestamp: message.created_at,
    ...(isEmployeeMessage && message.employees_uuid
      ? {
          authorName: message.employees_display_name ?? author?.name ?? 'Staff',
          ...(authorRole ? { authorRole } : {}),
        }
      : {}),
  };
};

export const mapInquiry = (
  inquiry: ApiInquiry,
  staffDirectoryByUuid: ReadonlyMap<string, StaffDirectoryEntry>,
): InquiryConversation => {
  const parentName = `${inquiry.parent_first_name ?? ''} ${inquiry.parent_last_name ?? ''}`.trim();
  const firstMessageTopic = inquiry.messages.find((message) => message.topic)?.topic ?? null;
  const topicCategory = categoryFrom(firstMessageTopic);
  const status = statusFrom(inquiry.status);
  const supportStatus = SUPPORT_STATUS_FROM_API[inquiry.support_status];
  const endedAt =
    inquiry.status === 'ended' || inquiry.status === 'resolved'
      ? inquiry.updated_at
      : new Date().toISOString();
  const durationMinutes = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(inquiry.created_at).getTime()) / 60_000),
  );

  return {
    uuid: inquiry.uuid,
    parentName: parentName || 'Unknown parent',
    parentInitials: initialsFrom(inquiry.parent_first_name, inquiry.parent_last_name),
    petName: inquiry.pet_name,
    topic: inquiry.pet_name ? `${inquiry.pet_name} - ${topicCategory}` : `${topicCategory} enquiry`,
    topicCategory,
    startedAt: inquiry.created_at,
    durationMinutes,
    status,
    supportStatus,
    // Not yet a real captured event - the schema doesn't record this timestamp.
    supportRequestedAt: null,
    assignee: inquiry.assigned_staff_uuid
      ? {
          id: inquiry.assigned_staff_uuid,
          name: staffDirectoryByUuid.get(inquiry.assigned_staff_uuid)?.name ?? 'Staff member',
        }
      : null,
    notes: inquiry.employee_notes ?? '',
    aiSummary: inquiry.ai_summary ?? '',
    // Not yet captured as distinct fields in the schema.
    aiDetectedTopic: '',
    aiEscalationReason: null,
    aiRelevantInfo: '',
    messages: inquiry.messages.map((message) => mapMessage(message, staffDirectoryByUuid)),
  };
};

export const fetchInquiries = async (
  staffDirectoryByUuid: ReadonlyMap<string, StaffDirectoryEntry>,
): Promise<InquiryConversation[]> => {
  const response = await fetch(BASE_URL, { credentials: 'include' });
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not load inquiries'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.inquiries)) {
    throw new InquiryApiError('The server sent inquiries it could not read', 500);
  }
  return (payload.inquiries as ApiInquiry[]).map((inquiry) =>
    mapInquiry(inquiry, staffDirectoryByUuid),
  );
};

export const fetchInquiry = async (
  conversationId: string,
  staffDirectoryByUuid: ReadonlyMap<string, StaffDirectoryEntry>,
): Promise<InquiryConversation> => {
  const response = await fetch(`${BASE_URL}/${encodeURIComponent(conversationId)}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not load the inquiry'),
      response.status,
    );
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.inquiry)) {
    throw new InquiryApiError('The server sent an inquiry it could not read', 500);
  }
  return mapInquiry(payload.inquiry as unknown as ApiInquiry, staffDirectoryByUuid);
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const assignStaffOnServer = async (
  conversationId: string,
  staffUuid: string | null,
): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/assignee`,
    jsonInit('PATCH', { assigned_staff_uuid: staffUuid }),
  );
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not update the assignee'),
      response.status,
    );
  }
};

export const resolveInquiryOnServer = async (conversationId: string): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/resolve`,
    jsonInit('POST'),
  );
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not resolve the conversation'),
      response.status,
    );
  }
};

export const saveNotesOnServer = async (conversationId: string, notes: string): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/notes`,
    jsonInit('PATCH', { notes }),
  );
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not save the notes'),
      response.status,
    );
  }
};

export const sendStaffMessageOnServer = async (
  conversationId: string,
  body: string,
): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(conversationId)}/messages`,
    jsonInit('POST', { body }),
  );
  if (!response.ok) {
    throw new InquiryApiError(
      await messageFrom(response, 'Could not send the reply'),
      response.status,
    );
  }
};

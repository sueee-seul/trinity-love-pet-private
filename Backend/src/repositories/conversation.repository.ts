import {
  ConversationModel,
  type ConversationCurrentEntity,
  type ConversationDocument,
  type ConversationPending,
  type ConversationRecentTopic,
  type PendingStayChange,
  type SupportStatus,
} from '../models/conversation.model.js';
import type { HydratedDocument } from 'mongoose';

export type ConversationRecord = HydratedDocument<ConversationDocument>;

export const findConversationsByOwner = async (
  ownerUuid: string,
): Promise<ConversationRecord[]> => {
  return ConversationModel.find({ pet_owners_uuid: ownerUuid }).sort({ created_at: -1 });
};

export const findAllConversations = async (): Promise<ConversationRecord[]> => {
  return ConversationModel.find({}).sort({ created_at: -1 });
};

export const findConversationById = async (
  conversationId: string,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findById(conversationId);
};

export const createConversation = async (ownerUuid: string): Promise<ConversationRecord> => {
  return ConversationModel.create({
    pet_owners_uuid: ownerUuid,
    status: 'active',
    current_entity: null,
    pending: { pet_uuid: null, topic: null, request_text: null },
    referenced_pets_uuids: [],
    recent_topics: [],
  });
};

export const touchConversation = async (conversationId: string): Promise<void> => {
  await ConversationModel.updateOne({ _id: conversationId }, { $set: { updated_at: new Date() } });
};

export const endConversation = async (
  conversationId: string,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { status: 'ended', support_status: 'resolved' } },
    { returnDocument: 'after' },
  );
};

/** A staff member closing a conversation - kept distinct from `endConversation` (the pet owner's own close) so the two can be told apart later. */
export const resolveConversation = async (
  conversationId: string,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { status: 'resolved', support_status: 'resolved' } },
    { returnDocument: 'after' },
  );
};

export const setSupportStatus = async (
  conversationId: string,
  supportStatus: SupportStatus,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { support_status: supportStatus } },
    { returnDocument: 'after' },
  );
};

export interface ConversationStateUpdate {
  current_entity: ConversationCurrentEntity | null;
  pending: ConversationPending;
  referenced_pets_uuids: string[];
  recent_topics: ConversationRecentTopic[];
}

/** Persists the AI chatbot resolver's updated context stack after a turn - see conversation.ai.service.ts. */
export const updateConversationState = async (
  conversationId: string,
  state: ConversationStateUpdate,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { ...state, updated_at: new Date() } },
    { returnDocument: 'after' },
  );
};

/** Keeps (or, with null, drops) the stay change the chat is waiting on. */
export const setPendingStayChange = async (
  conversationId: string,
  pending: PendingStayChange | null,
): Promise<void> => {
  await ConversationModel.updateOne(
    { _id: conversationId },
    { $set: { pending_stay_change: pending, updated_at: new Date() } },
  );
};

/**
 * Takes the quoted stay change for one turn: clears it only if it is still the one quoted at
 * `createdAt`. Two quick "yes" messages race here, and only the first gets true, so a change is
 * never applied twice.
 */
export const claimPendingStayChange = async (
  conversationId: string,
  createdAt: string,
): Promise<boolean> => {
  const result = await ConversationModel.updateOne(
    { _id: conversationId, 'pending_stay_change.created_at': createdAt },
    { $set: { pending_stay_change: null, updated_at: new Date() } },
  );
  return result.modifiedCount === 1;
};

export const setEmployeeNotes = async (
  conversationId: string,
  notes: string,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { employee_notes: notes } },
    { returnDocument: 'after' },
  );
};

export const assignStaff = async (
  conversationId: string,
  staffUuid: string | null,
): Promise<ConversationRecord | null> => {
  return ConversationModel.findByIdAndUpdate(
    conversationId,
    {
      $set: {
        assigned_staff_uuid: staffUuid,
        support_status: staffUuid ? 'support_assigned' : 'support_requested',
      },
    },
    { returnDocument: 'after' },
  );
};

/**
 * The one line staff read on Inquiries about why the chat handed this conversation to a person.
 * Each hand-over replaces it, so it always explains the latest one.
 */
export const setAiSummary = async (conversationId: string, summary: string): Promise<void> => {
  await ConversationModel.updateOne({ _id: conversationId }, { $set: { ai_summary: summary } });
};

import {
  MessageModel,
  type MessageDocument,
  type MessageIntent,
  type MessageOutcome,
  type MessageSenderRole,
  type PetOverviewCard,
  type StayAnswerCache,
  type StayClarificationCache,
} from '../models/message.model.js';
import type { HydratedDocument } from 'mongoose';

export type MessageRecord = HydratedDocument<MessageDocument>;

export const findMessagesByConversation = async (
  conversationId: string,
): Promise<MessageRecord[]> => {
  return MessageModel.find({ conversations_uuid: conversationId }).sort({ created_at: 1 });
};

export const findMessagesByConversations = async (
  conversationIds: string[],
): Promise<MessageRecord[]> => {
  return MessageModel.find({ conversations_uuid: { $in: conversationIds } }).sort({
    created_at: 1,
  });
};

export interface CreatePetOwnerMessageInput {
  conversationId: string;
  body: string;
  petUuid: string | null;
  bookingPetsUuid: string | null;
}

export const createPetOwnerMessage = async (
  input: CreatePetOwnerMessageInput,
): Promise<MessageRecord> => {
  return MessageModel.create({
    conversations_uuid: input.conversationId,
    sender_role: 'pet_owner',
    topic: null,
    body: input.body,
    employees_uuid: null,
    pets_uuid: input.petUuid,
    booking_pets_uuid: input.bookingPetsUuid,
    intent: 'qa',
    outcome: 'clear',
    compared_pets_uuids: null,
    resolver_metadata: {
      candidates: null,
      invalid_name: null,
      booking_hint: null,
      pet_cards: null,
      stay_answer_cache: null,
      stay_clarification_cache: null,
    },
  });
};

export interface CreateAiMessageInput {
  conversationId: string;
  body: string;
  topic: string | null;
  petUuid: string | null;
  bookingPetsUuid: string | null;
  intent: MessageIntent;
  outcome: MessageOutcome;
  comparedPetsUuids: string[] | null;
  resolverMetadata: {
    candidates: string[] | null;
    invalid_name: string | null;
    booking_hint: string | null;
    pet_cards: PetOverviewCard[] | null;
    stay_answer_cache?: StayAnswerCache | null;
    stay_clarification_cache?: StayClarificationCache | null;
    action_replies?: string[] | null;
  };
}

export const createAiMessage = async (input: CreateAiMessageInput): Promise<MessageRecord> => {
  return MessageModel.create({
    conversations_uuid: input.conversationId,
    sender_role: 'ai',
    topic: input.topic,
    body: input.body,
    employees_uuid: null,
    pets_uuid: input.petUuid,
    booking_pets_uuid: input.bookingPetsUuid,
    intent: input.intent,
    outcome: input.outcome,
    compared_pets_uuids: input.comparedPetsUuids,
    resolver_metadata: input.resolverMetadata,
  });
};

/** Either a regular staff reply or a manager's - both count as "a human has responded" for the support-status transition. */
export const hasEmployeeMessage = async (conversationId: string): Promise<boolean> => {
  const existing = await MessageModel.exists({
    conversations_uuid: conversationId,
    sender_role: { $in: ['staff', 'manager'] },
  });
  return existing !== null;
};

export interface CreateStaffMessageInput {
  conversationId: string;
  body: string;
  employeeUuid: string;
  employeeDisplayName: string;
  senderRole: MessageSenderRole;
}

export const createStaffMessage = async (
  input: CreateStaffMessageInput,
): Promise<MessageRecord> => {
  return MessageModel.create({
    conversations_uuid: input.conversationId,
    sender_role: input.senderRole,
    topic: null,
    body: input.body,
    employees_uuid: input.employeeUuid,
    employees_display_name: input.employeeDisplayName,
    pets_uuid: null,
    booking_pets_uuid: null,
    intent: 'qa',
    outcome: 'clear',
    compared_pets_uuids: null,
    resolver_metadata: {
      candidates: null,
      invalid_name: null,
      booking_hint: null,
      pet_cards: null,
      stay_answer_cache: null,
      stay_clarification_cache: null,
    },
  });
};

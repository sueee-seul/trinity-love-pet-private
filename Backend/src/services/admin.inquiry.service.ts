import { AppError } from '../common/middlewares/error.middleware.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as messageRepository from '../repositories/message.repository.js';
import * as adminInquiriesRepository from '../repositories/admin.inquiries.repository.js';
import type { ConversationRecord } from '../repositories/conversation.repository.js';
import type { MessageRecord } from '../repositories/message.repository.js';
import type { PetOwnerName } from '../repositories/admin.inquiries.repository.js';
import type { AdminInquiryDto } from '../contracts/admin.inquiry.contract.js';
import type { ConversationMessageDto } from '../contracts/conversation.contract.js';
import { toMessageDto } from './conversation.service.js';
import { publishConversationEvent } from './conversation.events.js';

const notFound = (): AppError => new AppError('Conversation not found', 'NOT_FOUND', 404);

const toAdminInquiryDto = (
  conversation: ConversationRecord,
  messages: MessageRecord[],
  owner: PetOwnerName | undefined,
  petName: string | null,
): AdminInquiryDto => ({
  uuid: conversation._id.toString(),
  pet_owners_uuid: conversation.pet_owners_uuid,
  parent_first_name: owner?.first_name ?? null,
  parent_last_name: owner?.last_name ?? null,
  pet_uuid: conversation.current_entity?.pet_uuid ?? null,
  pet_name: petName,
  status: conversation.status,
  created_at: conversation.created_at.toISOString(),
  updated_at: conversation.updated_at.toISOString(),
  assigned_staff_uuid: conversation.assigned_staff_uuid,
  ai_summary: conversation.ai_summary,
  employee_notes: conversation.employee_notes,
  support_status: conversation.support_status,
  messages: messages.map(toMessageDto),
});

/** Looks up the owner/pet names for a single conversation, reusing the same batch lookups the list endpoint uses. */
const enrichOne = async (
  conversation: ConversationRecord,
): Promise<{ owner: PetOwnerName | undefined; petName: string | null }> => {
  const petUuid = conversation.current_entity?.pet_uuid ?? null;
  const [ownerNames, petNames] = await Promise.all([
    adminInquiriesRepository.findPetOwnerNames([conversation.pet_owners_uuid]),
    adminInquiriesRepository.findPetNames(petUuid ? [petUuid] : []),
  ]);
  return {
    owner: ownerNames.get(conversation.pet_owners_uuid),
    petName: petUuid ? (petNames.get(petUuid) ?? null) : null,
  };
};

export const listInquiriesForStaff = async (): Promise<AdminInquiryDto[]> => {
  const conversations = await conversationRepository.findAllConversations();
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

  const ownerUuids = [
    ...new Set(conversations.map((conversation) => conversation.pet_owners_uuid)),
  ];
  const petUuids = [
    ...new Set(
      conversations
        .map((conversation) => conversation.current_entity?.pet_uuid)
        .filter((petUuid): petUuid is string => Boolean(petUuid)),
    ),
  ];

  const [ownerNames, petNames] = await Promise.all([
    adminInquiriesRepository.findPetOwnerNames(ownerUuids),
    adminInquiriesRepository.findPetNames(petUuids),
  ]);

  return conversations.map((conversation) => {
    const petUuid = conversation.current_entity?.pet_uuid ?? null;
    return toAdminInquiryDto(
      conversation,
      messagesByConversation.get(conversation._id.toString()) ?? [],
      ownerNames.get(conversation.pet_owners_uuid),
      petUuid ? (petNames.get(petUuid) ?? null) : null,
    );
  });
};

export const assignInquiryStaff = async (
  conversationId: string,
  staffUuid: string | null,
): Promise<AdminInquiryDto> => {
  const conversation = await conversationRepository.assignStaff(conversationId, staffUuid);
  if (!conversation) {
    throw notFound();
  }

  const [messages, { owner, petName }] = await Promise.all([
    messageRepository.findMessagesByConversation(conversationId),
    enrichOne(conversation),
  ]);
  return toAdminInquiryDto(conversation, messages, owner, petName);
};

export const resolveInquiry = async (conversationId: string): Promise<AdminInquiryDto> => {
  const conversation = await conversationRepository.resolveConversation(conversationId);
  if (!conversation) {
    throw notFound();
  }

  const [messages, { owner, petName }] = await Promise.all([
    messageRepository.findMessagesByConversation(conversationId),
    enrichOne(conversation),
  ]);
  return toAdminInquiryDto(conversation, messages, owner, petName);
};

export const updateInquiryNotes = async (
  conversationId: string,
  notes: string,
): Promise<AdminInquiryDto> => {
  const conversation = await conversationRepository.setEmployeeNotes(conversationId, notes);
  if (!conversation) {
    throw notFound();
  }

  const [messages, { owner, petName }] = await Promise.all([
    messageRepository.findMessagesByConversation(conversationId),
    enrichOne(conversation),
  ]);
  return toAdminInquiryDto(conversation, messages, owner, petName);
};

export const postStaffMessage = async (
  conversationId: string,
  employeeUuid: string,
  employeeRole: 'manager' | 'staff' | null,
  body: string,
): Promise<ConversationMessageDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }

  const [isFirstEmployeeMessage, employeeDisplayName] = await Promise.all([
    messageRepository.hasEmployeeMessage(conversationId).then((exists) => !exists),
    adminInquiriesRepository.findUserDisplayName(employeeUuid),
  ]);

  const message = await messageRepository.createStaffMessage({
    conversationId,
    body,
    employeeUuid,
    employeeDisplayName,
    senderRole: employeeRole === 'manager' ? 'manager' : 'staff',
  });
  await conversationRepository.touchConversation(conversationId);

  // The first time a staff member actually replies, the conversation moves
  // from merely "assigned" to being actively handled - unless it's already
  // wrapped up, which a stray late reply shouldn't undo.
  if (isFirstEmployeeMessage && conversation.support_status !== 'resolved') {
    await conversationRepository.setSupportStatus(conversationId, 'support_handling');
  }

  publishConversationEvent(conversationId);

  return toMessageDto(message);
};

export const getInquiry = async (conversationId: string): Promise<AdminInquiryDto> => {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw notFound();
  }

  const [messages, { owner, petName }] = await Promise.all([
    messageRepository.findMessagesByConversation(conversationId),
    enrichOne(conversation),
  ]);
  return toAdminInquiryDto(conversation, messages, owner, petName);
};

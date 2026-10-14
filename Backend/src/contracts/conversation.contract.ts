import type { PetOverviewCard } from '../models/message.model.js';

export type ConversationStatus = 'active' | 'ended' | 'resolved' | 'handed_off';
export type SupportStatus =
  'ai_handling' | 'support_requested' | 'support_assigned' | 'support_handling' | 'resolved';
export type MessageSenderRole = 'pet_owner' | 'ai' | 'staff' | 'manager';

export interface ConversationMessageDto {
  uuid: string;
  conversations_uuid: string;
  created_at: string;
  sender_role: MessageSenderRole;
  topic: string | null;
  body: string;
  employees_uuid: string | null;
  employees_display_name: string | null;
  pets_uuid: string | null;
  booking_pets_uuid: string | null;
  quick_replies?: string[];
  pet_cards?: PetOverviewCard[];
}

export interface ConversationDto {
  uuid: string;
  pet_owners_uuid: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  current_entity: { pet_uuid: string; booking_pets_uuid: string } | null;
  assigned_staff_uuid: string | null;
  ai_summary: string | null;
  employee_notes: string | null;
  support_status: SupportStatus;
  messages: ConversationMessageDto[];
}

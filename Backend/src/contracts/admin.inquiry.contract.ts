import type {
  ConversationMessageDto,
  ConversationStatus,
  SupportStatus,
} from './conversation.contract.js';

export interface AdminInquiryDto {
  uuid: string;
  pet_owners_uuid: string;
  parent_first_name: string | null;
  parent_last_name: string | null;
  pet_uuid: string | null;
  pet_name: string | null;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  assigned_staff_uuid: string | null;
  ai_summary: string | null;
  employee_notes: string | null;
  support_status: SupportStatus;
  messages: ConversationMessageDto[];
}

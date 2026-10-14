import { Schema, model } from 'mongoose';

/**
 * `ended` is the pet owner closing their own conversation; `resolved` is a
 * staff member closing it from the admin side - kept distinct so the two can
 * be told apart later (e.g. in reporting), even though both are terminal.
 */
export type ConversationStatus = 'active' | 'ended' | 'resolved' | 'handed_off';

/** Mirrors the admin UI's SupportStatusBadge states - a real, stored field rather than something derived on the fly. */
export type SupportStatus =
  'ai_handling' | 'support_requested' | 'support_assigned' | 'support_handling' | 'resolved';

export interface ConversationCurrentEntity {
  pet_uuid: string;
  booking_pets_uuid: string;
}

export interface ConversationPending {
  pet_uuid: string | null;
  topic: string | null;
  request_text: string | null;
}

export interface ConversationRecentTopic {
  pet_uuid: string;
  topic: string;
}

/**
 * `early_check_out` is read only to answer it: leaving earlier is arranged with the team, since the
 * early pick-up change was removed on 7 Oct 2026. `pick_up` is a new check-out day or time.
 */
export type StayChangeIntent =
  'extend' | 'early_check_out' | 'add_on' | 'pick_up' | 'cancel' | 'move_dates';

export type AddOnWord = 'walk' | 'grooming' | 'bath' | 'playtime' | 'training';

/** A change the parent asked for in the chat, as read by conversation.stay-change.parse.ts. */
export interface StayChangeRequest {
  intent: StayChangeIntent;
  /** A New Zealand calendar date the message names, YYYY-MM-DD. */
  date: string | null;
  /** A time of day the message names, HH:mm on a 24-hour clock. */
  time: string | null;
  /** "Two more nights": how many nights to add; only for an extension. */
  nights: number | null;
  /** Which add-on the message asks for. */
  addOn: AddOnWord | null;
  /** A second date, when the message names a range ("20 to 23 October"). */
  endDate?: string | null;
}

export type StayChangeKind = 'extend' | 'add_on' | 'pick_up_time' | 'cancel' | 'move_dates';

export interface StayChangeChoice {
  label: string;
  booking_id: string;
  booking_pet_ids: string[];
  pet_names: string[];
}

/**
 * A stay change the chat is waiting on between turns (conversation.stay-changes.ts):
 * - `confirm`: a change was priced and quoted; a yes applies it at `amount`.
 * - `choose_pet`: the request fits more than one pet or stay; the parent picks one of `choices`.
 * - `ask_when`: moving the dates of a stay with no new dates yet.
 */
export interface PendingStayChange {
  kind: StayChangeKind | null;
  stage: 'confirm' | 'choose_pet' | 'ask_when';
  booking_id: string | null;
  booking_pet_ids: string[];
  pet_names: string[];
  /** New drop-off date, for moving a stay that has not started. */
  start_date?: string | null;
  end_date: string | null;
  pick_up_time: string | null;
  pick_up_date: string | null;
  service_id: string | null;
  service_name: string | null;
  service_date: string | null;
  amount: number | null;
  choices: StayChangeChoice[];
  request: StayChangeRequest | null;
  created_at: string;
}

export interface ConversationDocument {
  pet_owners_uuid: string;
  status: ConversationStatus;
  created_at: Date;
  updated_at: Date;
  current_entity: ConversationCurrentEntity | null;
  pending: ConversationPending;
  referenced_pets_uuids: string[];
  recent_topics: ConversationRecentTopic[];
  assigned_staff_uuid: string | null;
  ai_summary: string | null;
  employee_notes: string | null;
  support_status: SupportStatus;
  /** A stay change quoted in the chat and waiting for the parent's yes; null when none is. */
  pending_stay_change: PendingStayChange | null;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    pet_owners_uuid: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'ended', 'resolved', 'handed_off'],
      required: true,
      default: 'active',
    },
    current_entity: {
      type: new Schema<ConversationCurrentEntity>(
        {
          pet_uuid: { type: String, required: true },
          booking_pets_uuid: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    pending: {
      type: new Schema<ConversationPending>(
        {
          pet_uuid: { type: String, default: null },
          topic: { type: String, default: null },
          request_text: { type: String, default: null },
        },
        { _id: false },
      ),
      default: (): ConversationPending => ({ pet_uuid: null, topic: null, request_text: null }),
    },
    referenced_pets_uuids: { type: [String], default: [] },
    recent_topics: {
      type: [
        new Schema<ConversationRecentTopic>(
          {
            pet_uuid: { type: String, required: true },
            topic: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    assigned_staff_uuid: { type: String, default: null },
    ai_summary: { type: String, default: null },
    employee_notes: { type: String, default: null },
    support_status: {
      type: String,
      enum: [
        'ai_handling',
        'support_requested',
        'support_assigned',
        'support_handling',
        'resolved',
      ],
      required: true,
      default: 'ai_handling',
    },
    // Written and read only by conversation.stay-changes.ts, which owns its shape.
    pending_stay_change: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: 'conversations',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const ConversationModel = model<ConversationDocument>('Conversation', conversationSchema);

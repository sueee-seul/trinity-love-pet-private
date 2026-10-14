import { Schema, model } from 'mongoose';

/** `manager` is a staff member's message sent while their account's employee role is manager - a distinct value, not a flag on `staff`, so it's unambiguous straight from the stored data. */
export type MessageSenderRole = 'pet_owner' | 'ai' | 'staff' | 'manager';
export type MessageIntent = 'qa' | 'new_workflow';
export type MessageOutcome = 'clear' | 'ambiguous' | 'invalid' | 'compare' | 'unsupported';

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

export interface StayAnswerCache {
  question_hash: string;
  pet_uuid: string;
  booking_pets_uuids: string[];
  activity: string;
  all_stays: boolean;
  explicit_stay_scope: boolean;
  records_hash: string;
}

export interface StayClarificationCache {
  question_hash: string;
  pet_uuid: string;
  activity: string;
  booking_pets_uuids: string[];
  stay_labels: string[];
}

export interface MessageResolverMetadata {
  candidates: string[] | null;
  invalid_name: string | null;
  booking_hint: string | null;
  pet_cards?: PetOverviewCard[] | null;
  stay_answer_cache?: StayAnswerCache | null;
  stay_clarification_cache?: StayClarificationCache | null;
  /** Buttons under a stay-change reply ("Confirm" / "Cancel", or the pets to choose from). */
  action_replies?: string[] | null;
}

export interface MessageDocument {
  conversations_uuid: string;
  created_at: Date;
  sender_role: MessageSenderRole;
  topic: string | null;
  body: string;
  employees_uuid: string | null;
  /** Snapshot of the sender's display name at send time - stored directly so the UI never has to resolve it through a permission-gated staff directory lookup. */
  employees_display_name: string | null;
  pets_uuid: string | null;
  booking_pets_uuid: string | null;
  intent: MessageIntent;
  outcome: MessageOutcome;
  compared_pets_uuids: string[] | null;
  resolver_metadata: MessageResolverMetadata;
}

const messageSchema = new Schema<MessageDocument>(
  {
    conversations_uuid: { type: String, required: true, index: true },
    sender_role: { type: String, enum: ['pet_owner', 'ai', 'staff', 'manager'], required: true },
    topic: { type: String, default: null },
    body: { type: String, required: true },
    employees_uuid: { type: String, default: null },
    employees_display_name: { type: String, default: null },
    pets_uuid: { type: String, default: null },
    booking_pets_uuid: { type: String, default: null },
    intent: { type: String, enum: ['qa', 'new_workflow'], required: true },
    outcome: {
      type: String,
      enum: ['clear', 'ambiguous', 'invalid', 'compare', 'unsupported'],
      required: true,
    },
    compared_pets_uuids: { type: [String], default: null },
    resolver_metadata: {
      type: new Schema<MessageResolverMetadata>(
        {
          candidates: { type: [String], default: null },
          action_replies: { type: [String], default: null },
          invalid_name: { type: String, default: null },
          booking_hint: { type: String, default: null },
          pet_cards: {
            type: [
              new Schema<PetOverviewCard>(
                {
                  profile: {
                    name: { type: String, required: true },
                    species: { type: String, required: true },
                    breed: { type: String, default: null },
                    age: { type: Number, default: null },
                    weight: { type: Number, default: null },
                    image_url: { type: String, default: null },
                  },
                  answer: { type: String, default: null },
                  event_photos: [
                    new Schema(
                      {
                        url: { type: String, required: true },
                        alt: { type: String, required: true },
                      },
                      { _id: false },
                    ),
                  ],
                  stays: [
                    new Schema<PetOverviewStay>(
                      {
                        stay: { type: String, required: true },
                        drop_off_time: { type: String, default: null },
                        pick_up_time: { type: String, default: null },
                        booking_status: { type: String, default: null },
                        care_information: {
                          feeding_routine: { type: String, default: null },
                          medication_instructions: { type: String, default: null },
                          first_time_boarding: { type: Boolean, default: null },
                          crate_trained: { type: Boolean, default: null },
                          other_notes: { type: String, default: null },
                          allows_socialization: { type: Boolean, default: null },
                          fully_vaccinated: { type: Boolean, default: null },
                          behavior_and_health_notes: { type: String, default: null },
                        },
                        booked_services: [
                          new Schema(
                            {
                              name: { type: String, required: true },
                              category: {
                                type: String,
                                enum: ['boarding_rate', 'food', 'addon'],
                                required: true,
                              },
                            },
                            { _id: false },
                          ),
                        ],
                      },
                      { _id: false },
                    ),
                  ],
                },
                { _id: false },
              ),
            ],
            default: null,
          },
          stay_answer_cache: {
            type: new Schema<StayAnswerCache>(
              {
                question_hash: { type: String, required: true },
                pet_uuid: { type: String, required: true },
                booking_pets_uuids: { type: [String], required: true },
                activity: { type: String, required: true },
                all_stays: { type: Boolean, required: true },
                explicit_stay_scope: { type: Boolean, required: true },
                records_hash: { type: String, required: true },
              },
              { _id: false },
            ),
            default: null,
          },
          stay_clarification_cache: {
            type: new Schema<StayClarificationCache>(
              {
                question_hash: { type: String, required: true },
                pet_uuid: { type: String, required: true },
                activity: { type: String, required: true },
                booking_pets_uuids: { type: [String], required: true },
                stay_labels: { type: [String], required: true },
              },
              { _id: false },
            ),
            default: null,
          },
        },
        { _id: false },
      ),
      default: (): MessageResolverMetadata => ({
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: null,
      }),
    },
  },
  {
    collection: 'messages',
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
);

export const MessageModel = model<MessageDocument>('Message', messageSchema);

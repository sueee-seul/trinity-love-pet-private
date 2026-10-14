import { describe, expect, it } from 'vitest';
import { MessageModel } from '../models/message.model.js';

describe('MessageModel pet overview card persistence', () => {
  it('keeps structured pet and stay information in resolver metadata', async () => {
    const message = new MessageModel({
      conversations_uuid: 'conversation-1',
      sender_role: 'ai',
      topic: 'pet_overview',
      body: 'Pet overview',
      employees_uuid: null,
      employees_display_name: null,
      pets_uuid: null,
      booking_pets_uuid: null,
      intent: 'qa',
      outcome: 'clear',
      compared_pets_uuids: null,
      resolver_metadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: [
          {
            profile: { name: 'Biscuit', species: 'dog', breed: 'Spaniel', age: 5, weight: 18 },
            answer: 'Biscuit gets two meals each day.',
            stays: [
              {
                stay: 'Current stay',
                drop_off_time: '2026-09-08T12:00:00.000Z',
                pick_up_time: '2026-09-10T12:00:00.000Z',
                booking_status: 'confirmed',
                care_information: {
                  feeding_routine: 'Two meals daily',
                  medication_instructions: null,
                  first_time_boarding: null,
                  crate_trained: true,
                  other_notes: null,
                  allows_socialization: true,
                  fully_vaccinated: true,
                  behavior_and_health_notes: null,
                },
                booked_services: [{ name: 'Chicken meal plan', category: 'food' }],
              },
            ],
          },
        ],
        stay_answer_cache: {
          question_hash: 'question-hash',
          pet_uuid: 'pet-1',
          booking_pets_uuids: ['booking-1'],
          activity: 'feeding',
          all_stays: false,
          explicit_stay_scope: true,
          records_hash: 'records-hash',
        },
        stay_clarification_cache: {
          question_hash: 'clarification-hash',
          pet_uuid: 'pet-1',
          booking_pets_uuids: ['booking-1', 'booking-2'],
          activity: 'feeding',
          stay_labels: ['Current stay', 'Upcoming stay'],
        },
      },
    });

    await expect(message.validate()).resolves.toBeUndefined();
    expect(message.toObject().resolver_metadata.pet_cards?.[0]?.stays[0]?.booked_services).toEqual([
      { name: 'Chicken meal plan', category: 'food' },
    ]);
    expect(message.toObject().resolver_metadata.pet_cards?.[0]?.answer).toBe(
      'Biscuit gets two meals each day.',
    );
    expect(message.toObject().resolver_metadata.stay_answer_cache?.booking_pets_uuids).toEqual([
      'booking-1',
    ]);
  });
});

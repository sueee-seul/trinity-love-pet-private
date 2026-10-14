import { connectToMongoDB, closeMongoConnection, mongoose } from '../config/mongodb.js';
import { ConversationModel } from '../models/conversation.model.js';
import { MessageModel } from '../models/message.model.js';

// Real Postgres UUIDs (from pet_owners / pets / booking_pets) so the seeded
// conversations reference rows that actually exist for local testing.
const SARAH = '20000000-0000-4000-8000-000000000011';
const BISCUIT = '30000000-0000-4000-8000-000000000001';
const BISCUIT_BOOKING = '42000000-0000-4000-8000-000000000001';
const LUNA = '30000000-0000-4000-8000-000000000002';

const LIAM = '20000000-0000-4000-8000-000000000012';
const REX = '30000000-0000-4000-8000-000000000003';
const REX_BOOKING = '42000000-0000-4000-8000-000000000003';
const BRUNO = '30000000-0000-4000-8000-000000000010';

const PRIYA = '20000000-0000-4000-8000-000000000013';
const MOCHI = '30000000-0000-4000-8000-000000000004';
const MOCHI_BOOKING = '42000000-0000-4000-8000-000000000006';

const HANA = '20000000-0000-4000-8000-000000000015';
const COCO = '30000000-0000-4000-8000-000000000006';
const MILO = '30000000-0000-4000-8000-000000000007';
const MILO_BOOKING = '42000000-0000-4000-8000-000000000005';

const EMMA = '20000000-0000-4000-8000-000000000016';
const ZIGGY = '30000000-0000-4000-8000-000000000008';
const ZIGGY_BOOKING = '42000000-0000-4000-8000-000000000007';
const DAISY = '30000000-0000-4000-8000-000000000009';

const BEN = '20000000-0000-4000-8000-000000000014';
const PEPPER = '30000000-0000-4000-8000-000000000005';
const PEPPER_BOOKING = '42000000-0000-4000-8000-000000000009';

const SENIOR_PET_CARER = '20000000-0000-4000-8000-000000000002';
const GROOMER = '20000000-0000-4000-8000-000000000003';

const { ObjectId } = mongoose.Types;

const minutesAfter = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000);

const seedConversations = async (): Promise<void> => {
  await connectToMongoDB();

  await ConversationModel.deleteMany({});
  await MessageModel.deleteMany({});

  const now = new Date();
  const conversationDocs: Record<string, unknown>[] = [];
  const messageDocs: Record<string, unknown>[] = [];

  // 1. Sarah: active, two pets on the same stay, ends in a "compare" question.
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -60);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: SARAH,
      status: 'active',
      created_at: t0,
      updated_at: minutesAfter(t0, 6),
      current_entity: { pet_uuid: BISCUIT, booking_pets_uuid: BISCUIT_BOOKING },
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [BISCUIT, LUNA],
      recent_topics: [
        { pet_uuid: BISCUIT, topic: 'feeding' },
        { pet_uuid: LUNA, topic: 'feeding' },
      ],
      support_status: 'ai_handling',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'feeding',
        body: "What's Biscuit's feeding routine?",
        employees_uuid: null,
        pets_uuid: BISCUIT,
        booking_pets_uuid: BISCUIT_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 1),
        sender_role: 'ai',
        topic: 'feeding',
        body: 'Biscuit is on two meals a day, 8am and 6pm, with the grain-free kibble you dropped off.',
        employees_uuid: null,
        pets_uuid: BISCUIT,
        booking_pets_uuid: BISCUIT_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 5),
        sender_role: 'pet_owner',
        topic: 'feeding',
        body: 'How are Biscuit and Luna both doing with meals this week?',
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'compare',
        compared_pets_uuids: [BISCUIT, LUNA],
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 6),
        sender_role: 'ai',
        topic: 'feeding',
        body: "Both are eating well. Biscuit's finishing every bowl, and Luna's back to her normal appetite after a slow start on day one.",
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'compare',
        compared_pets_uuids: [BISCUIT, LUNA],
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
    );
  }

  // 2. Liam: active, owner doesn't name a pet, so the AI has to ask which one.
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -30);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: LIAM,
      status: 'active',
      created_at: t0,
      updated_at: minutesAfter(t0, 3),
      current_entity: { pet_uuid: REX, booking_pets_uuid: REX_BOOKING },
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [REX, BRUNO],
      recent_topics: [{ pet_uuid: REX, topic: 'exercise' }],
      // Dummy data for the SupportStatusBadge - imagine Liam asked for a human afterwards, not yet assigned.
      support_status: 'support_requested',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'exercise',
        body: 'Is my dog getting enough exercise today?',
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'ambiguous',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: [REX, BRUNO], invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 1),
        sender_role: 'ai',
        topic: 'exercise',
        body: 'You have two pets checked in: Rex and Bruno. Which one did you mean?',
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'ambiguous',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: [REX, BRUNO], invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 3),
        sender_role: 'pet_owner',
        topic: 'exercise',
        body: 'Rex',
        employees_uuid: null,
        pets_uuid: REX,
        booking_pets_uuid: REX_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
    );
  }

  // 3. Priya: ended, single pet, single clean Q&A exchange.
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -180);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: PRIYA,
      status: 'ended',
      created_at: t0,
      updated_at: minutesAfter(t0, 2),
      current_entity: { pet_uuid: MOCHI, booking_pets_uuid: MOCHI_BOOKING },
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [MOCHI],
      recent_topics: [{ pet_uuid: MOCHI, topic: 'medication' }],
      // Closed without ever needing a human.
      support_status: 'ai_handling',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'medication',
        body: 'Has Mochi had her medication today?',
        employees_uuid: null,
        pets_uuid: MOCHI,
        booking_pets_uuid: MOCHI_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 2),
        sender_role: 'ai',
        topic: 'medication',
        body: 'Yes, Mochi had her morning dose at 9am with breakfast.',
        employees_uuid: null,
        pets_uuid: MOCHI,
        booking_pets_uuid: MOCHI_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
    );
  }

  // 4. Hana: handed off to a human after the AI can't help with a booking change.
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -15);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: HANA,
      status: 'handed_off',
      created_at: t0,
      updated_at: minutesAfter(t0, 4),
      current_entity: { pet_uuid: MILO, booking_pets_uuid: MILO_BOOKING },
      pending: { pet_uuid: null, topic: 'extend_stay', request_text: null },
      referenced_pets_uuids: [COCO, MILO],
      recent_topics: [{ pet_uuid: MILO, topic: 'booking_change' }],
      // Alex (the sender of the staff message below) is actively handling this one.
      assigned_staff_uuid: SENIOR_PET_CARER,
      support_status: 'support_handling',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'booking_change',
        body: "Can you extend Milo's stay by three more days?",
        employees_uuid: null,
        pets_uuid: MILO,
        booking_pets_uuid: MILO_BOOKING,
        intent: 'new_workflow',
        outcome: 'unsupported',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: 'extend_stay' },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 1),
        sender_role: 'ai',
        topic: 'booking_change',
        body: "I can't change booking dates directly, so I've looped in one of our staff to help with that.",
        employees_uuid: null,
        pets_uuid: MILO,
        booking_pets_uuid: MILO_BOOKING,
        intent: 'new_workflow',
        outcome: 'unsupported',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: 'extend_stay' },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 4),
        sender_role: 'staff',
        topic: 'booking_change',
        body: "Hi Hana, it's Tom from the front desk. Happy to extend Milo's stay. I'm just confirming the new pick-up date with you now.",
        employees_uuid: SENIOR_PET_CARER,
        employees_display_name: 'Tom Reilly',
        pets_uuid: MILO,
        booking_pets_uuid: MILO_BOOKING,
        intent: 'new_workflow',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: 'extend_stay' },
      },
    );
  }

  // 5. Emma: the owner misnames a pet, the AI catches the invalid name.
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -10);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: EMMA,
      status: 'active',
      created_at: t0,
      updated_at: minutesAfter(t0, 2),
      current_entity: { pet_uuid: ZIGGY, booking_pets_uuid: ZIGGY_BOOKING },
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [ZIGGY, DAISY],
      recent_topics: [{ pet_uuid: ZIGGY, topic: 'grooming' }],
      // Assigned to the groomer but they haven't replied yet.
      assigned_staff_uuid: GROOMER,
      support_status: 'support_assigned',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'grooming',
        body: 'Did Ziggo get his grooming session yet?',
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'invalid',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: 'Ziggo', booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 1),
        sender_role: 'ai',
        topic: 'grooming',
        body: "I don't have a pet named Ziggo under your account. Did you mean Ziggy?",
        employees_uuid: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        intent: 'qa',
        outcome: 'invalid',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: [ZIGGY], invalid_name: 'Ziggo', booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 2),
        sender_role: 'pet_owner',
        topic: 'grooming',
        body: 'Yes, Ziggy',
        employees_uuid: null,
        pets_uuid: ZIGGY,
        booking_pets_uuid: ZIGGY_BOOKING,
        intent: 'qa',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
    );
  }

  // 6. Ben: resolved by staff (status "resolved", distinct from a pet owner's own "ended").
  {
    const conversationId = new ObjectId();
    const t0 = minutesAfter(now, -50);
    conversationDocs.push({
      _id: conversationId,
      pet_owners_uuid: BEN,
      status: 'resolved',
      created_at: t0,
      updated_at: minutesAfter(t0, 8),
      current_entity: { pet_uuid: PEPPER, booking_pets_uuid: PEPPER_BOOKING },
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [PEPPER],
      recent_topics: [{ pet_uuid: PEPPER, topic: 'medication' }],
      assigned_staff_uuid: SENIOR_PET_CARER,
      support_status: 'resolved',
    });
    messageDocs.push(
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: t0,
        sender_role: 'pet_owner',
        topic: 'medication',
        body: "Pepper's vet changed her dosage. Can someone update her care plan?",
        employees_uuid: null,
        pets_uuid: PEPPER,
        booking_pets_uuid: PEPPER_BOOKING,
        intent: 'new_workflow',
        outcome: 'unsupported',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
      {
        _id: new ObjectId(),
        conversations_uuid: conversationId.toHexString(),
        created_at: minutesAfter(t0, 8),
        sender_role: 'staff',
        topic: 'medication',
        body: "Hi Ben, it's Tom. I've updated Pepper's care plan with the new dosage. All set!",
        employees_uuid: SENIOR_PET_CARER,
        employees_display_name: 'Tom Reilly',
        pets_uuid: PEPPER,
        booking_pets_uuid: PEPPER_BOOKING,
        intent: 'new_workflow',
        outcome: 'clear',
        compared_pets_uuids: null,
        resolver_metadata: { candidates: null, invalid_name: null, booking_hint: null },
      },
    );
  }

  await ConversationModel.insertMany(conversationDocs);
  await MessageModel.insertMany(messageDocs);

  console.log(
    `Seeded ${conversationDocs.length} conversations and ${messageDocs.length} messages.`,
  );
};

try {
  await seedConversations();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Mongo seeding failed');
  process.exitCode = 1;
} finally {
  await closeMongoConnection();
}

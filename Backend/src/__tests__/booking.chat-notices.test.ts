import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const conversations = vi.hoisted(() => ({
  findConversationsByOwner: vi.fn(),
  createConversation: vi.fn(),
  touchConversation: vi.fn(),
}));
const messages = vi.hoisted(() => ({ createAiMessage: vi.fn() }));
const events = vi.hoisted(() => ({
  publishConversationEvent: vi.fn(),
  publishInquiryCreated: vi.fn(),
}));

vi.mock('../repositories/conversation.repository.js', () => conversations);
vi.mock('../repositories/message.repository.js', () => messages);
vi.mock('../services/conversation.events.js', () => events);

import { BOOKING_STATUS_TOPIC, postBookingNoticeToChat } from '../services/booking.chat-notices.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const BOOKING_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const conversation = (
  id: string,
  status: string,
): { _id: { toString: () => string }; status: string } => ({
  _id: { toString: () => id },
  status,
});

const approved = {
  ownerId: OWNER_ID,
  bookingId: BOOKING_ID,
  kind: 'booking_approved' as const,
  body: "Max's stay, 12 to 15 Oct 2026, is approved.",
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  messages.createAiMessage.mockResolvedValue({});
  conversations.touchConversation.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('postBookingNoticeToChat', () => {
  it("posts the manager's answer into the parent's open conversation", async () => {
    conversations.findConversationsByOwner.mockResolvedValue([
      conversation('ended-1', 'ended'),
      conversation('open-1', 'active'),
    ]);

    await postBookingNoticeToChat(approved);

    expect(messages.createAiMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'open-1',
        body: "Confirmed: Max's stay, 12 to 15 Oct 2026, is approved.",
        topic: BOOKING_STATUS_TOPIC,
      }),
    );
    expect(conversations.createConversation).not.toHaveBeenCalled();
    expect(events.publishConversationEvent).toHaveBeenCalledWith('open-1');
  });

  it('starts a conversation when the parent has none open', async () => {
    conversations.findConversationsByOwner.mockResolvedValue([conversation('ended-1', 'ended')]);
    conversations.createConversation.mockResolvedValue(conversation('new-1', 'active'));

    await postBookingNoticeToChat({
      ...approved,
      kind: 'booking_refused',
      body: "We can't take Max.",
    });

    expect(conversations.createConversation).toHaveBeenCalledWith(OWNER_ID);
    expect(events.publishInquiryCreated).toHaveBeenCalledWith('new-1');
    expect(messages.createAiMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'new-1' }),
    );
  });

  it('leaves other notices to the bell', async () => {
    await postBookingNoticeToChat({ ...approved, kind: 'booking_daily_update' });
    await postBookingNoticeToChat(null);

    expect(conversations.findConversationsByOwner).not.toHaveBeenCalled();
    expect(messages.createAiMessage).not.toHaveBeenCalled();
  });

  it('never throws, and logs ids only', async () => {
    conversations.findConversationsByOwner.mockRejectedValue(new Error('Max'));

    await expect(postBookingNoticeToChat(approved)).resolves.toBeUndefined();

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain(BOOKING_ID);
    expect(logged).not.toContain('Max');
  });
});

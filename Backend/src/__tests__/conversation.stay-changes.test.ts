import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandWallClockToDate } from '../common/utils/new-zealand-time.js';
import type { MyBookingPetRow } from '../repositories/petparent.booking.read.repository.js';
import {
  PENDING_STAY_CHANGE_TTL_MS,
  runStayChangeTurn,
  type PendingStayChange,
  type StayChangeDependencies,
  type StayChangeTurn,
} from '../services/conversation.stay-changes.js';

/** Wednesday 7 October 2026, 2pm in Auckland. */
const NOW = newZealandWallClockToDate('2026-10-07', '14:00');
const OWNER = 'owner-1';
const BOOKING = 'booking-1';

const row = (overrides: Partial<MyBookingPetRow> = {}): MyBookingPetRow => ({
  bookingPetId: 'bp-bella',
  bookingId: BOOKING,
  createdAt: new Date('2026-09-20T00:00:00Z'),
  petId: 'pet-bella',
  petName: 'Bella',
  petSpecies: 'dog',
  petPhotoUrl: null,
  dropOffTime: newZealandWallClockToDate('2026-10-05', '09:00'),
  pickUpTime: newZealandWallClockToDate('2026-10-10', '11:00'),
  reviewStatus: 'approved',
  checkInOutcome: 'checked_in',
  refusalReason: null,
  reviewerName: null,
  caringInfo: null,
  services: [],
  ...overrides,
});

const MAX = row({ bookingPetId: 'bp-max', petId: 'pet-max', petName: 'Max' });

const deps = (overrides: StayChangeDependencies = {}): StayChangeDependencies => ({
  now: () => NOW,
  listBookings: vi.fn(async () => [row()]),
  previewExtension: vi.fn(async (_owner, _booking, endDate: string) => ({
    currentEndDate: '2026-10-10',
    newEndDate: endDate,
    addedNights: endDate === '2026-10-11' ? 1 : 2,
    pets: [{ bookingPetId: 'bp-bella', petName: 'Bella', nightlyRate: 68, amount: 68 }],
    amount: endDate === '2026-10-11' ? 68 : 136,
    settlement: 'card' as const,
  })),
  extendStay: vi.fn(async (_owner, _booking, input) => ({
    currentEndDate: '2026-10-10',
    newEndDate: input.endDate,
    addedNights: 1,
    pets: [{ bookingPetId: 'bp-bella', petName: 'Bella', nightlyRate: 68, amount: 68 }],
    amount: 68,
    settlement: 'card' as const,
    chargeId: 'charge-1',
  })),
  listAddOns: vi.fn(async () => ({
    offers: [
      {
        serviceId: 'svc-walk',
        name: 'Extra walk',
        description: null,
        price: 15,
        priceUnit: 'per day',
      },
      {
        serviceId: 'svc-groom',
        name: 'Grooming',
        description: null,
        price: 55,
        priceUnit: 'per stay',
      },
      {
        serviceId: 'svc-med',
        name: 'Medication administration',
        description: null,
        price: 6,
        priceUnit: 'per day',
      },
    ],
    days: ['2026-10-07', '2026-10-08', '2026-10-09'],
    settlement: 'card' as const,
  })),
  bookAddOn: vi.fn(async (_owner, _booking, bookingPetId, input) => ({
    chargeId: 'charge-2',
    bookingPetId,
    petName: bookingPetId === 'bp-max' ? 'Max' : 'Bella',
    serviceName: 'Extra walk',
    date: input.date,
    quantity: 1,
    amount: 15,
    taskId: 'task-1',
    settlement: 'card' as const,
  })),
  changeStayTimes: vi.fn(async () => ({
    dropOffAt: newZealandWallClockToDate('2026-10-05', '09:00').toISOString(),
    pickUpAt: newZealandWallClockToDate('2026-10-10', '15:00').toISOString(),
  })),
  claimPending: vi.fn(async () => true),
  ...overrides,
});

const say = (
  userMessage: string,
  dependencies: StayChangeDependencies,
  pending: PendingStayChange | null = null,
  language: 'en' | 'zh' = 'en',
): Promise<StayChangeTurn | null> =>
  runStayChangeTurn({ ownerId: OWNER, userMessage, language, pending }, dependencies);

/** Asks for a change and returns the turn, failing the test when nothing was quoted. */
const quoted = async (
  userMessage: string,
  dependencies: StayChangeDependencies,
): Promise<StayChangeTurn & { pending: PendingStayChange }> => {
  const turn = await say(userMessage, dependencies);
  if (!turn?.pending) throw new Error(`expected a quote for "${userMessage}"`);
  return turn as StayChangeTurn & { pending: PendingStayChange };
};

describe('extending a stay from the chat', () => {
  it('quotes one more night at the previewed price and asks to confirm', async () => {
    const d = deps();
    const turn = await quoted('Can I extend the stay by one night?', d);

    expect(d.previewExtension).toHaveBeenCalledWith(OWNER, BOOKING, '2026-10-11');
    expect(turn.reply).toContain('NZ$68.00');
    expect(turn.reply).toContain('Sun 11 Oct');
    expect(turn.reply).toMatch(/Shall I go ahead\?$/);
    expect(turn.quickReplies).toEqual(['Confirm', 'Cancel']);
    expect(turn.pending).toMatchObject({ kind: 'extend', end_date: '2026-10-11', amount: 68 });
    expect(d.extendStay).not.toHaveBeenCalled();
  });

  it('extends on a yes, with the amount the parent was shown, and says what was charged', async () => {
    const d = deps();
    const { pending } = await quoted('Can I extend the stay by one night?', d);

    const done = await say('yes please', d, pending);

    expect(d.claimPending).toHaveBeenCalledTimes(1);
    expect(d.extendStay).toHaveBeenCalledWith(OWNER, BOOKING, {
      endDate: '2026-10-11',
      expectedAmount: 68,
    });
    expect(done?.reply).toMatch(/^Done: Bella now stays until Sun 11 Oct\. NZ\$68\.00 was charged/);
    expect(done?.pending).toBeNull();
  });

  it('quotes the new price instead of charging when the price moved since the quote', async () => {
    const d = deps({
      extendStay: vi.fn(async () => {
        throw new AppError('The price changed', 'EXTENSION_PRICE_CHANGED', 409, [{ amount: 74 }]);
      }),
    });
    const { pending } = await quoted('one more night please', d);

    const again = await say('confirm', d, pending);

    expect(again?.reply).toContain('NZ$74.00');
    expect(again?.pending).toMatchObject({ kind: 'extend', amount: 74 });
    expect(again?.quickReplies).toEqual(['Confirm', 'Cancel']);
  });

  it('changes nothing on a no', async () => {
    const d = deps();
    const { pending } = await quoted('Can I extend the stay by one night?', d);

    const turn = await say('Cancel', d, pending);

    expect(turn).toEqual({
      reply: "OK, I haven't changed anything.",
      quickReplies: null,
      pending: null,
    });
    expect(d.extendStay).not.toHaveBeenCalled();
  });

  it('never applies an old quote: after 15 minutes a yes is just a message', async () => {
    const d = deps();
    const { pending } = await quoted('Can I extend the stay by one night?', d);
    const stale = {
      ...pending,
      created_at: new Date(NOW.getTime() - PENDING_STAY_CHANGE_TTL_MS - 1).toISOString(),
    };

    expect(await say('yes', d, stale)).toBeNull();
    expect(d.extendStay).not.toHaveBeenCalled();
  });

  it('does not apply twice when another turn already took the quote', async () => {
    const d = deps({ claimPending: vi.fn(async () => false) });
    const { pending } = await quoted('Can I extend the stay by one night?', d);

    const turn = await say('yes', d, pending);

    expect(turn?.reply).toBe('That change is already being made.');
    expect(d.extendStay).not.toHaveBeenCalled();
  });

  it('says plainly when the card is declined, and keeps nothing waiting', async () => {
    const d = deps({
      extendStay: vi.fn(async () => {
        throw new AppError('declined', 'CARD_DECLINED', 402);
      }),
    });
    const { pending } = await quoted('Can I extend the stay by one night?', d);

    const turn = await say('ok', d, pending);

    expect(turn?.reply).toMatch(/^Your card was declined, so nothing was changed/);
    expect(turn?.pending).toBeNull();
  });

  it('names the full nights when there is no room', async () => {
    const d = deps({
      previewExtension: vi.fn(async () => {
        throw new AppError('full', 'CONCIERGE_FULLY_BOOKED', 409, [{ night: '2026-10-11' }]);
      }),
    });

    const turn = await say('Can Bella stay two more nights?', d);

    expect(turn?.reply).toContain("We're full on Sun 11 Oct");
    expect(turn?.pending).toBeNull();
  });

  it('answers in Chinese for a parent who reads Chinese', async () => {
    const d = deps();
    const turn = await say('能不能多住一晚？', d, null, 'zh');

    expect(turn?.reply).toContain('NZ$68.00');
    expect(turn?.reply).toContain('10月11日（周日）');
    expect(turn?.reply).toContain('要我帮你办理吗？');
    expect(turn?.quickReplies).toEqual(['确认', '取消']);
  });

  it('tells the parent when no stay is under way, without calling any service', async () => {
    const d = deps({ listBookings: vi.fn(async () => [row({ checkInOutcome: null })]) });

    const turn = await say('Can I extend the stay by one night?', d);

    expect(turn?.reply).toMatch(/can't see a stay under way/);
    expect(d.previewExtension).not.toHaveBeenCalled();
  });
});

describe('leaving early from the chat', () => {
  it('says early check-out is arranged with the team and prices nothing', async () => {
    const d = deps();
    const turn = await say('Can I pick Bella up early, on Thursday at 4pm?', d);

    expect(turn?.reply).toMatch(/contact our team/);
    expect(turn?.pending).toBeNull();
    expect(d.changeStayTimes).not.toHaveBeenCalled();
  });

  it('answers in Chinese with check-out words', async () => {
    const turn = await say('我想明天提前离店', deps(), null, 'zh');

    expect(turn?.reply).toContain('提前离店');
    expect(turn?.reply).not.toMatch(/接走|来接/);
  });
});

describe('a new check-out day or time', () => {
  it('quotes a free time change on the booked day and applies it to every pet', async () => {
    const d = deps({ listBookings: vi.fn(async () => [row(), MAX]) });
    const turn = await quoted('Can I pick them up at 3pm instead?', d);

    expect(turn.reply).toBe(
      "I'll move Bella and Max's check-out on Sat 10 Oct to 3:00 pm. This doesn't change the price. Shall I go ahead?",
    );
    const done = await say('yes', d, turn.pending);

    expect(d.changeStayTimes).toHaveBeenCalledTimes(2);
    expect(d.changeStayTimes).toHaveBeenCalledWith(OWNER, BOOKING, 'bp-max', {
      pickUpTime: '15:00',
    });
    expect(done?.reply).toBe(
      'Done: check-out is now 3:00 pm on Sat 10 Oct. The team has been told.',
    );
  });

  it('treats a later day as an extension and points an earlier day to the team', async () => {
    const d = deps();
    await say("I'll collect her on Monday instead", d);
    expect(d.previewExtension).toHaveBeenCalledWith(OWNER, BOOKING, '2026-10-12');

    const earlier = await say('Can we move check-out to Thursday?', d);
    expect(earlier?.reply).toMatch(/can't move check-out to an earlier day/);
    expect(earlier?.pending).toBeNull();
  });

  it('only moves the time of a stay that has not started; dates go through My Stays', async () => {
    const upcoming = row({
      checkInOutcome: null,
      dropOffTime: newZealandWallClockToDate('2026-10-12', '09:00'),
      pickUpTime: newZealandWallClockToDate('2026-10-15', '11:00'),
    });
    const d = deps({ listBookings: vi.fn(async () => [upcoming]) });

    const time = await say('Can I pick her up at 2pm instead?', d);
    expect(time?.pending).toMatchObject({ kind: 'pick_up_time', pick_up_date: '2026-10-15' });

    const dates = await say("I'll pick her up on Friday instead", d);
    expect(dates?.reply).toMatch(/Change dates in My Stays/);
  });
});

describe('add-ons from the chat', () => {
  it('asks which pet when two are staying, then quotes for the one chosen', async () => {
    const d = deps({ listBookings: vi.fn(async () => [row(), MAX]) });
    const ask = await quoted('Can I add a walk tomorrow?', d);
    expect(ask.reply).toBe('Which pet is this for?');
    expect(ask.quickReplies).toEqual(['Bella', 'Max']);

    const turn = await say('Max', d, ask.pending);

    expect(turn?.reply).toBe(
      'Extra walk for Max on Thu 8 Oct: NZ$15.00 (GST included), charged to the card saved on this booking. Shall I book it?',
    );
    const done = await say('yes', d, turn?.pending ?? null);
    expect(d.bookAddOn).toHaveBeenCalledWith(OWNER, BOOKING, 'bp-max', {
      serviceId: 'svc-walk',
      date: '2026-10-08',
      quantity: 1,
      expectedAmount: 15,
    });
    expect(done?.reply).toMatch(
      /^Booked: Extra walk for Max on Thu 8 Oct\. NZ\$15\.00 was charged/,
    );
  });

  it('says the add-on goes on the bill for check-out when the booking has no saved card', async () => {
    const d = deps({
      listAddOns: vi.fn(async () => ({
        offers: [
          {
            serviceId: 'svc-walk',
            name: 'Extra walk',
            description: null,
            price: 15,
            priceUnit: 'per day',
          },
        ],
        days: ['2026-10-07', '2026-10-08'],
        settlement: 'desk' as const,
      })),
      bookAddOn: vi.fn(async (_owner, _booking, bookingPetId, input) => ({
        chargeId: 'charge-3',
        bookingPetId,
        petName: 'Bella',
        serviceName: 'Extra walk',
        date: input.date,
        quantity: 1,
        amount: 15,
        taskId: 'task-2',
        settlement: 'desk' as const,
      })),
    });
    const turn = await quoted('Can I add a walk tomorrow?', d);
    expect(turn.reply).toContain('added to your bill and paid at the desk when you check out');

    const done = await say('yes', d, turn.pending);
    expect(done?.reply).toContain('to pay at the desk when you check out');
    expect(done?.reply).not.toMatch(/charged/);
  });

  it('offers the add-ons it can book when the one asked for is not on the list', async () => {
    const d = deps();

    const turn = await say('Please book her a training session', d);

    expect(turn?.reply).toBe(
      'I can book these for this stay: Extra walk, Grooming. Which would you like?',
    );
    expect(turn?.quickReplies).toEqual(['Add Extra walk', 'Add Grooming']);
  });
});

describe('messages that are not stay changes', () => {
  it('leaves questions to the normal chat', async () => {
    const d = deps();
    expect(await say("How's Bella today?", d)).toBeNull();
    expect(d.listBookings).not.toHaveBeenCalled();
  });

  it('lets an unrelated message drop a quote instead of confirming it', async () => {
    const d = deps();
    const { pending } = await quoted('Can I extend the stay by one night?', d);

    expect(await say('Did she eat her breakfast?', d, pending)).toBeNull();
    expect(d.extendStay).not.toHaveBeenCalled();
  });
});

describe('cancelling or moving a stay that has not started', () => {
  /** Arrives Monday 12 October, leaves Thursday 15 October: three nights. */
  const upcoming = row({
    checkInOutcome: null,
    dropOffTime: newZealandWallClockToDate('2026-10-12', '09:00'),
    pickUpTime: newZealandWallClockToDate('2026-10-15', '11:00'),
  });

  const beforeTheStay = (overrides: StayChangeDependencies = {}): StayChangeDependencies =>
    deps({
      listBookings: vi.fn(async () => [upcoming]),
      previewCancellation: vi.fn(async () => ({
        fee: 68,
        rule: 'late' as const,
        total: 204,
        contact: { email: null, phone: null },
      })),
      cancelByGuest: vi.fn(async () => ({ fee: 68 })),
      previewReschedule: vi.fn(async (_owner, _booking, dates) => ({
        startDate: dates.startDate,
        endDate: dates.endDate,
        nights: 3,
        total: 204,
        usesFreeReschedule: false,
        holdAt: '2026-10-18T09:00:00.000Z',
        paysNow: true,
      })),
      rescheduleByGuest: vi.fn(async (_owner, _booking, input) => ({
        startDate: input.startDate,
        endDate: input.endDate,
        nights: 3,
        total: 204,
        usesFreeReschedule: false,
        holdAt: '2026-10-18T09:00:00.000Z',
        paysNow: true,
        held: true,
      })),
      ...overrides,
    });

  it('quotes the cancellation fee and cancels on a yes with that fee', async () => {
    const d = beforeTheStay();
    const turn = await quoted('Please cancel the booking', d);

    expect(turn.reply).toBe(
      "Cancelling Bella's stay now costs NZ$68.00 under your booking terms; anything else held or paid on your card is released or refunded. Shall I cancel it?",
    );
    const done = await say('yes', d, turn.pending);

    expect(d.cancelByGuest).toHaveBeenCalledWith(OWNER, BOOKING, { expectedFee: 68 });
    expect(done?.reply).toMatch(/^Cancelled\. NZ\$68\.00 was kept under the booking terms/);
  });

  it('moves the stay to a date range, quoted first, applied with the quoted total', async () => {
    const d = beforeTheStay();
    const turn = await quoted('Can we move the booking to 20 to 23 October?', d);

    expect(d.previewReschedule).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-10-20',
      endDate: '2026-10-23',
    });
    expect(turn.reply).toContain('Tue 20 Oct until Fri 23 Oct (3 nights) comes to NZ$204.00');
    const done = await say('confirm', d, turn.pending);

    expect(d.rescheduleByGuest).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-10-20',
      endDate: '2026-10-23',
      expectedTotal: 204,
    });
    expect(done?.reply).toMatch(/^Done: the stay is now Tue 20 Oct until Fri 23 Oct\./);
  });

  it('keeps the length of the stay when only a new start is given', async () => {
    const d = beforeTheStay();
    await say('Move the stay to 25 Oct', d);
    expect(d.previewReschedule).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-10-25',
      endDate: '2026-10-28',
    });
  });

  it('asks for the new dates when none were given, then quotes them', async () => {
    const d = beforeTheStay();
    const ask = await quoted('改期', d);
    expect(ask.reply).toBe('Which dates would you like instead? For example "20 to 23 October".');

    const turn = await say('10月20日到10月23日', d, ask.pending);
    expect(turn?.pending).toMatchObject({ kind: 'move_dates', start_date: '2026-10-20' });
  });

  it('reads "cancel the booking" as a request even while another quote waits', async () => {
    const d = beforeTheStay();
    const { pending } = await quoted('Move the stay to 25 Oct', d);

    const turn = await say('取消这次预订', d, pending, 'zh');
    expect(turn?.reply).toContain('现在取消Bella的住宿，按预订条款收取NZ$68.00');
  });

  it('points to extending once the stay has started', async () => {
    const d = deps();
    const turn = await say('Please cancel the booking', d);
    expect(turn?.reply).toMatch(/already started/);
    expect(turn?.reply).not.toMatch(/pick-up/);
  });
});

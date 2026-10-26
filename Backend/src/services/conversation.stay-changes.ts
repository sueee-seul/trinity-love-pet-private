import { AppError } from '../common/middlewares/error.middleware.js';
import {
  formatNewZealandDay,
  formatNewZealandTime,
  newZealandDateOf,
  newZealandWallClockToDate,
} from '../common/utils/new-zealand-time.js';
import {
  ADD_ON_PRICE_CHANGED,
  CANCELLATION_FEE_CHANGED,
  RESCHEDULE_PRICE_CHANGED,
  EXTENSION_PRICE_CHANGED,
  type AddOnOffer,
  type ChargeSettlement,
} from '../contracts/booking.change.contract.js';
import type {
  PendingStayChange,
  StayChangeChoice,
  StayChangeKind,
} from '../models/conversation.model.js';
import {
  listBookingsForOwner,
  type MyBookingPetRow,
} from '../repositories/petparent.booking.read.repository.js';
import { listAddOns } from './booking.guest-addon.js';
import { cancelByGuest, previewCancellation } from './booking.guest-change.js';
import { previewReschedule, rescheduleByGuest } from './booking.guest-reschedule.js';
import { previewExtension } from './booking.guest-extend.js';
import { requestAddOn, requestExtension, requestTimes } from './stay-change-requests.js';
import {
  addDays,
  isConfirmation,
  isDecline,
  parseDateRange,
  parseStayChange,
  type AddOnWord,
  type StayChangeRequest,
} from './conversation.stay-change.parse.js';

/**
 * The parent chat acting on a stay itself (Scenario 11 outcome 5: "handle booking changes,
 * extensions and add-on services autonomously against facility availability and the parent's
 * payment method"). The chat no longer only links to My stays: it reads the request, prices it with
 * the same services My stays uses, and makes the change once the parent says yes. Leaving early is
 * not a change here: early pick-up was removed on 7 Oct 2026, so the chat points to the team.
 *
 * Money rules (docs/in-stay-change-tools.md): price first, then confirm, then apply. Every amount
 * in a reply comes from a preview or a result of those services, never from a model; the change is
 * applied with the amount the parent was shown, and a price that moved in between is quoted again
 * instead of charged. Only the result of the apply may say a change is done. The services check the
 * stay belongs to the parent, has room and is under way, write the ledger, the receipt email, the
 * parent's notice and the manager's notice.
 */

export type ChatLanguage = 'en' | 'zh';

export type { PendingStayChange, StayChangeChoice, StayChangeKind };

export interface StayChangeTurn {
  reply: string;
  /** Tappable answers under the reply: Confirm / Cancel, or the pets to choose from. */
  quickReplies: string[] | null;
  /** What to keep on the conversation for the next turn; null clears it. */
  pending: PendingStayChange | null;
}

export interface StayChangeDependencies {
  now?: () => Date;
  listBookings?: (ownerId: string) => Promise<MyBookingPetRow[]>;
  previewExtension?: typeof previewExtension;
  requestExtension?: typeof requestExtension;
  listAddOns?: typeof listAddOns;
  requestAddOn?: typeof requestAddOn;
  requestTimes?: typeof requestTimes;
  previewCancellation?: typeof previewCancellation;
  cancelByGuest?: typeof cancelByGuest;
  previewReschedule?: typeof previewReschedule;
  rescheduleByGuest?: typeof rescheduleByGuest;
  /**
   * Takes the quoted change for this turn only, so two quick "yes" messages cannot both apply it.
   * False when another turn already took it.
   */
  claimPending?: () => Promise<boolean>;
}

export interface StayChangeTurnInput {
  ownerId: string;
  userMessage: string;
  language: ChatLanguage;
  pending: PendingStayChange | null;
}

/** A quoted price is good for this long; after it the parent asks again and gets a fresh price. */
export const PENDING_STAY_CHANGE_TTL_MS = 15 * 60_000;

// ----- Words ---------------------------------------------------------------------------------------

const money = (amount: number): string => `NZ$${amount.toFixed(2)}`;

const ZH_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const dayOf = (isoDate: string, language: ChatLanguage): string => {
  const noon = newZealandWallClockToDate(isoDate, '12:00');
  if (language === 'en') return formatNewZealandDay(noon);
  const [, month = '', day = ''] = isoDate.split('-');
  const weekday = ZH_WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()] ?? '';
  return `${Number(month)}月${Number(day)}日（周${weekday}）`;
};

const timeOf = (time: string, language: ChatLanguage): string => {
  if (language === 'zh') return time;
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'am' : 'pm';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const instantOf = (instant: Date, language: ChatLanguage): string =>
  language === 'en'
    ? `${dayOf(newZealandDateOf(instant), language)} at ${timeOf(formatNewZealandTime(instant), language)}`
    : `${dayOf(newZealandDateOf(instant), language)} ${formatNewZealandTime(instant)}`;

const namesOf = (names: string[], language: ChatLanguage): string => {
  if (language === 'zh') return names.join('和');
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const possessive = (names: string[], language: ChatLanguage): string =>
  language === 'zh' ? `${namesOf(names, language)}的` : `${namesOf(names, language)}'s`;

const nightsOf = (nights: number, language: ChatLanguage): string =>
  language === 'zh' ? `${nights}晚` : nights === 1 ? '1 night' : `${nights} nights`;

/** How a priced change is paid: on the saved card, or added to the bill for check-out. */
const EN_HOW_PAID: Record<ChargeSettlement, string> = {
  card: 'charged to the card saved on this booking',
  desk: 'added to your bill and paid at the desk when you check out',
};
const ZH_HOW_PAID: Record<ChargeSettlement, string> = {
  card: '从这笔预订保存的银行卡扣款',
  desk: '记入账单，离店时在前台支付',
};

const CONFIRM_REPLIES: Record<ChatLanguage, string[]> = {
  en: ['Confirm', 'Cancel'],
  zh: ['确认', '取消'],
};

const COPY = {
  en: {
    noStayUnderWay:
      "I can change a stay while your pet is with us, but I can't see a stay under way right now. For a booking that hasn't started, you can change the dates or cancel it in My Stays.",
    noStay:
      "I can't see an upcoming or current stay to change. You can check your bookings in My Stays.",
    choosePet: 'Which pet is this for?',
    chooseStay: 'Which stay is this for?',
    earlyCheckOut:
      "I can't move check-out to an earlier day here. If you would like to check out early, please contact our team and they will sort it out with you.",
    nothingChanged: "OK, I haven't changed anything.",
    alreadyTaken: 'That change is already being made.',
    alreadyThen: (when: string): string => `Check-out is already ${when}.`,
    notStartedDates:
      "To move the dates of a stay that hasn't started yet, use Change dates in My Stays.",
    extendPreview: (
      pets: string[],
      newEnd: string,
      nights: number,
      amount: number,
      settlement: ChargeSettlement,
    ): string =>
      `Extending ${possessive(pets, 'en')} stay to ${dayOf(newEnd, 'en')} adds ${nightsOf(nights, 'en')} at the rates you booked: ${money(amount)} (GST included), ${EN_HOW_PAID[settlement]}. Check-out stays at the same time of day. Shall I go ahead?`,
    addOnPreview: (
      service: string,
      pet: string,
      date: string,
      amount: number,
      settlement: ChargeSettlement,
    ): string =>
      `${service} for ${pet} on ${dayOf(date, 'en')}: ${money(amount)} (GST included), ${EN_HOW_PAID[settlement]}. Shall I book it?`,
    timePreview: (pets: string[], date: string, time: string): string =>
      `I'll move ${possessive(pets, 'en')} check-out on ${dayOf(date, 'en')} to ${timeOf(time, 'en')}. This doesn't change the price. Shall I go ahead?`,
    changeRequested: (summary: string): string =>
      `I've asked our manager to ${summary}. Nothing changes until it is approved, and I'll tell you here once they decide. Any amount is added to your bill, paid at the desk at pick-up.`,
    priceChanged: (amount: number): string =>
      `The price changed to ${money(amount)} since I checked. Shall I go ahead at the new price?`,
    cardDeclined:
      'Your card was declined, so nothing was changed. Please contact our team or use another card in My Stays.',
    fullyBooked: (nights: string[]): string =>
      `We're full on ${nights.map((night) => dayOf(night, 'en')).join(', ')}, so I can't extend to that date. Would an earlier date work?`,
    addOnChoices: (names: string[]): string =>
      `I can book these for this stay: ${names.join(', ')}. Which would you like?`,
    addOnNone:
      'There are no add-ons I can book for this stay right now. Our team can help with anything else.',
    addOnDays: (days: string[]): string =>
      `That can be booked for ${days.map((day) => dayOf(day, 'en')).join(', ')}. Which day would you like?`,
    addOnQuickReply: (name: string): string => `Add ${name}`,
    cancelPreview: (pets: string[], fee: number): string =>
      fee > 0
        ? `Cancelling ${possessive(pets, 'en')} stay now costs ${money(fee)} under your booking terms; anything else held or paid on your card is released or refunded. Shall I cancel it?`
        : `Cancelling ${possessive(pets, 'en')} stay now is free: anything held or paid on your card is released or refunded in full. Shall I cancel it?`,
    cancelDone: (fee: number): string =>
      fee > 0
        ? `Cancelled. ${money(fee)} was kept under the booking terms and the rest goes back to your card; refunds usually take a few working days to show.`
        : 'Cancelled, at no cost. Anything held or paid goes back to your card; refunds usually take a few working days to show.',
    movePreview: (
      pets: string[],
      start: string,
      end: string,
      nights: number,
      total: number,
      paysNow: boolean,
    ): string =>
      `Moving ${possessive(pets, 'en')} stay to ${dayOf(start, 'en')} until ${dayOf(end, 'en')} (${nightsOf(nights, 'en')}) comes to ${money(total)} at the rates you booked.${paysNow ? ' The new price is held on your card first, and the old payment is released or refunded.' : ''} Our manager will check the new dates again. Shall I move it?`,
    moveDone: (start: string, end: string, held: boolean): string =>
      `Done: the stay is now ${dayOf(start, 'en')} until ${dayOf(end, 'en')}.${held ? ' The new price is held on your card.' : ''} Our manager will confirm the new dates, and you will get a notice.`,
    askNewDates: 'Which dates would you like instead? For example "20 to 23 October".',
    alreadyStarted:
      "That stay has already started, so it can't be cancelled or moved here. I can extend it instead.",
  },
  zh: {
    noStayUnderWay:
      '宠物在店里寄养期间，我可以帮你更改住宿，但现在没有看到正在进行的住宿。还没开始的预订，可以在"我的住宿"里改日期或取消。',
    noStay: '没有看到可以更改的当前或即将开始的住宿。你可以在"我的住宿"里查看预订。',
    choosePet: '这是给哪只宠物的？',
    chooseStay: '是哪一次住宿？',
    earlyCheckOut: '这里无法把离店日期提前。如果想提前离店，请联系我们的团队，他们会和你一起安排。',
    nothingChanged: '好的，我没有做任何更改。',
    alreadyTaken: '这项更改已经在处理中了。',
    alreadyThen: (when: string): string => `离店时间已经是${when}。`,
    notStartedDates: '还没开始的住宿要改日期，请在"我的住宿"里使用"更改日期"。',
    extendPreview: (
      pets: string[],
      newEnd: string,
      nights: number,
      amount: number,
      settlement: ChargeSettlement,
    ): string =>
      `把${possessive(pets, 'zh')}住宿延长到${dayOf(newEnd, 'zh')}，按你预订时的价格增加${nightsOf(nights, 'zh')}：${money(amount)}（含GST），${ZH_HOW_PAID[settlement]}。离店的时间点不变。要我帮你办理吗？`,
    addOnPreview: (
      service: string,
      pet: string,
      date: string,
      amount: number,
      settlement: ChargeSettlement,
    ): string =>
      `${dayOf(date, 'zh')}为${pet}预订${service}：${money(amount)}（含GST），${ZH_HOW_PAID[settlement]}。要我帮你预订吗？`,
    timePreview: (pets: string[], date: string, time: string): string =>
      `我会把${possessive(pets, 'zh')}离店时间改到${dayOf(date, 'zh')} ${time}。价格不变。要我帮你办理吗？`,
    changeRequested: (): string =>
      '已把你的申请发给经理。批准之前不会有任何更改，经理决定后我会在这里告诉你。费用会记入账单，接走时在前台支付。',
    priceChanged: (amount: number): string =>
      `我查过之后价格变成了${money(amount)}。要按新价格办理吗？`,
    cardDeclined:
      '你的银行卡被拒绝了，所以没有做任何更改。请联系我们的团队，或在"我的住宿"里换一张卡。',
    fullyBooked: (nights: string[]): string =>
      `${nights.map((night) => dayOf(night, 'zh')).join('、')}已经住满，没法延长到那天。早一点的日期可以吗？`,
    addOnChoices: (names: string[]): string =>
      `这次住宿可以预订这些加项：${names.join('、')}。你想要哪一个？`,
    addOnNone: '这次住宿现在没有可以预订的加项。其他需要可以联系我们的团队。',
    addOnDays: (days: string[]): string =>
      `这项可以预订的日期是：${days.map((day) => dayOf(day, 'zh')).join('、')}。你想要哪一天？`,
    addOnQuickReply: (name: string): string => `加${name}`,
    cancelPreview: (pets: string[], fee: number): string =>
      fee > 0
        ? `现在取消${possessive(pets, 'zh')}住宿，按预订条款收取${money(fee)}，银行卡上其余冻结或已付的金额会释放或退回。要我帮你取消吗？`
        : `现在取消${possessive(pets, 'zh')}住宿不收费，银行卡上冻结或已付的金额会全部释放或退回。要我帮你取消吗？`,
    cancelDone: (fee: number): string =>
      fee > 0
        ? `已取消。按预订条款保留${money(fee)}，其余退回你的银行卡，一般需要几个工作日到账。`
        : '已取消，没有收费。冻结或已付的金额会退回你的银行卡，一般需要几个工作日到账。',
    movePreview: (
      pets: string[],
      start: string,
      end: string,
      nights: number,
      total: number,
      paysNow: boolean,
    ): string =>
      `把${possessive(pets, 'zh')}住宿改到${dayOf(start, 'zh')}至${dayOf(end, 'zh')}（${nightsOf(nights, 'zh')}），按你预订时的价格共${money(total)}。${paysNow ? '新的金额会先冻结在你的银行卡上，原来的付款会释放或退回。' : ''}经理会重新确认新的日期。要我帮你改吗？`,
    moveDone: (start: string, end: string, held: boolean): string =>
      `已改好：住宿改为${dayOf(start, 'zh')}至${dayOf(end, 'zh')}。${held ? '新的金额已冻结在你的银行卡上。' : ''}经理会确认新的日期，届时你会收到通知。`,
    askNewDates: '你想改到哪几天？例如"10月20日到10月23日"。',
    alreadyStarted: '这次住宿已经开始了，不能在这里取消或改日期。我可以帮你延长住宿。',
  },
} as const;

/** A refusal the services give, in the parent's words. English uses the service's own sentence. */
const ZH_REFUSALS: Record<string, string> = {
  STAY_NOT_UNDER_WAY:
    '这项更改只适用于正在寄养中的住宿（已入住、还没离店）。其他情况请联系我们的团队。',
  EXTENSION_DATES_INVALID: '请选择比现在的离店日期更晚的一天，整个住宿不超过60晚。',
  STAY_TIME_INVALID: '请选择一个还没过去的时间。',
  ADD_ON_NOT_OFFERED: '这次住宿那天无法预订这项加项。',
  BOOKING_NOT_CARD_GUARANTEED: '这笔预订没有保存银行卡，请联系我们的团队来更改。',
  BOOKING_NOT_FOUND: '我找不到这笔预订。',
};
const ZH_REFUSAL_FALLBACK = '这项更改没有完成，什么都没有改动。请稍后再试，或联系我们的团队。';

const PRICE_CHANGED_CODES = new Set([
  CANCELLATION_FEE_CHANGED,
  RESCHEDULE_PRICE_CHANGED,
  EXTENSION_PRICE_CHANGED,
  ADD_ON_PRICE_CHANGED,
]);

// ----- Reading the parent's stays -------------------------------------------------------------------

interface StayOption {
  bookingId: string;
  rows: MyBookingPetRow[];
  underWay: boolean;
  pickUpAt: Date;
}

/** Stays a change can apply to: approved pets not yet checked out, grouped by booking. */
const openStays = (rows: MyBookingPetRow[], now: Date): StayOption[] => {
  const byBooking = new Map<string, MyBookingPetRow[]>();
  for (const row of rows) {
    if (row.reviewStatus !== 'approved' || !row.dropOffTime || !row.pickUpTime) continue;
    if (row.pickUpTime.getTime() <= now.getTime()) continue;
    if (row.checkInOutcome !== null && row.checkInOutcome !== 'checked_in') continue;
    byBooking.set(row.bookingId, [...(byBooking.get(row.bookingId) ?? []), row]);
  }
  return [...byBooking.entries()].map(([bookingId, stayRows]) => ({
    bookingId,
    rows: stayRows,
    underWay: stayRows.every((row) => row.checkInOutcome === 'checked_in'),
    pickUpAt: new Date(Math.max(...stayRows.map((row) => row.pickUpTime?.getTime() ?? 0))),
  }));
};

/** Stays not started yet (waiting for the manager or confirmed, nobody arrived), by booking. */
const notStartedStays = (rows: MyBookingPetRow[], now: Date): StayOption[] => {
  const byBooking = new Map<string, MyBookingPetRow[]>();
  for (const row of rows) {
    if (row.reviewStatus !== 'approved' && row.reviewStatus !== 'pending') continue;
    if (!row.dropOffTime || !row.pickUpTime || row.checkInOutcome !== null) continue;
    if (row.dropOffTime.getTime() <= now.getTime()) continue;
    byBooking.set(row.bookingId, [...(byBooking.get(row.bookingId) ?? []), row]);
  }
  return [...byBooking.entries()].map(([bookingId, stayRows]) => ({
    bookingId,
    rows: stayRows,
    underWay: false,
    pickUpAt: new Date(Math.max(...stayRows.map((row) => row.pickUpTime?.getTime() ?? 0))),
  }));
};

const isBeforeTheStay = (request: StayChangeRequest): boolean =>
  request.intent === 'cancel' || request.intent === 'move_dates';

const mentions = (text: string, name: string): boolean =>
  name.length > 0 && text.toLowerCase().includes(name.toLowerCase());

// ----- One turn -------------------------------------------------------------------------------------

interface TurnContext {
  ownerId: string;
  text: string;
  language: ChatLanguage;
  now: Date;
  today: string;
  deps: Required<Omit<StayChangeDependencies, 'now' | 'claimPending'>> & {
    claimPending: (() => Promise<boolean>) | null;
  };
}

const said = (reply: string): StayChangeTurn => ({ reply, quickReplies: null, pending: null });

const emptyPending = (now: Date): PendingStayChange => ({
  kind: null,
  stage: 'confirm',
  booking_id: null,
  booking_pet_ids: [],
  pet_names: [],
  end_date: null,
  pick_up_time: null,
  pick_up_date: null,
  service_id: null,
  service_name: null,
  service_date: null,
  amount: null,
  choices: [],
  request: null,
  created_at: now.toISOString(),
});

const quote = (ctx: TurnContext, reply: string, pending: PendingStayChange): StayChangeTurn => ({
  reply,
  quickReplies: CONFIRM_REPLIES[ctx.language],
  pending,
});

/** A refusal from the services as a reply; anything that is not a refusal is a real failure. */
const refusal = (ctx: TurnContext, error: unknown): StayChangeTurn => {
  if (!(error instanceof AppError)) throw error;
  const copy = COPY[ctx.language];
  if (error.code === 'CARD_DECLINED') return said(copy.cardDeclined);
  if (error.code === 'CONCIERGE_FULLY_BOOKED') {
    const nights = (error.details ?? []).flatMap((detail) =>
      typeof detail === 'object' && detail !== null && 'night' in detail
        ? [String((detail as { night: unknown }).night)]
        : [],
    );
    return said(copy.fullyBooked(nights));
  }
  if (ctx.language === 'en') return said(error.message);
  return said(ZH_REFUSALS[error.code] ?? ZH_REFUSAL_FALLBACK);
};

const askToChoose = (
  ctx: TurnContext,
  request: StayChangeRequest,
  choices: StayChangeChoice[],
  perPet: boolean,
): StayChangeTurn => ({
  reply: perPet ? COPY[ctx.language].choosePet : COPY[ctx.language].chooseStay,
  quickReplies: choices.map((choice) => choice.label),
  pending: { ...emptyPending(ctx.now), stage: 'choose_pet', choices, request },
});

const choiceForStay = (stay: StayOption, language: ChatLanguage): StayChangeChoice => {
  const names = stay.rows.map((row) => row.petName);
  return {
    label: namesOf(names, language),
    booking_id: stay.bookingId,
    booking_pet_ids: stay.rows.map((row) => row.bookingPetId),
    pet_names: names,
  };
};

const choiceForPet = (stay: StayOption, row: MyBookingPetRow): StayChangeChoice => ({
  label: row.petName,
  booking_id: stay.bookingId,
  booking_pet_ids: [row.bookingPetId],
  pet_names: [row.petName],
});

/** Which stay (and, for an add-on, which pet) the request is for, or a question to ask. */
const pickTarget = (
  ctx: TurnContext,
  request: StayChangeRequest,
  stays: StayOption[],
): StayChangeChoice | StayChangeTurn => {
  const perPet = request.intent === 'add_on';
  const named = stays
    .map((stay) => ({ ...stay, rows: stay.rows.filter((row) => mentions(ctx.text, row.petName)) }))
    .filter((stay) => stay.rows.length > 0);
  if (perPet) {
    const pool = named.length > 0 ? named : stays;
    const pets = pool.flatMap((stay) => stay.rows.map((row) => choiceForPet(stay, row)));
    if (pets.length === 1 && pets[0]) return pets[0];
    return askToChoose(ctx, request, pets, true);
  }
  const pool =
    named.length > 0
      ? stays.filter((stay) => named.some((n) => n.bookingId === stay.bookingId))
      : stays;
  if (pool.length === 1 && pool[0]) return choiceForStay(pool[0], ctx.language);
  return askToChoose(
    ctx,
    request,
    pool.map((stay) => choiceForStay(stay, ctx.language)),
    false,
  );
};

const previewExtend = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
  stay: StayOption,
  endDate: string,
): Promise<StayChangeTurn> => {
  try {
    const preview = await ctx.deps.previewExtension(ctx.ownerId, target.booking_id, endDate);
    const pets = preview.pets.map((pet) => pet.petName);
    return quote(
      ctx,
      COPY[ctx.language].extendPreview(
        pets,
        preview.newEndDate,
        preview.addedNights,
        preview.amount,
        preview.settlement,
      ),
      {
        ...emptyPending(ctx.now),
        kind: 'extend',
        booking_id: target.booking_id,
        booking_pet_ids: stay.rows.map((row) => row.bookingPetId),
        pet_names: pets,
        end_date: preview.newEndDate,
        amount: preview.amount,
        request,
      },
    );
  } catch (error: unknown) {
    return refusal(ctx, error);
  }
};

const previewTime = (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
  date: string,
  time: string,
): StayChangeTurn =>
  quote(ctx, COPY[ctx.language].timePreview(target.pet_names, date, time), {
    ...emptyPending(ctx.now),
    kind: 'pick_up_time',
    booking_id: target.booking_id,
    booking_pet_ids: target.booking_pet_ids,
    pet_names: target.pet_names,
    pick_up_date: date,
    pick_up_time: time,
    amount: 0,
    request,
  });

const ADD_ON_NAME: Record<AddOnWord, RegExp> = {
  walk: /walk|散步|遛/i,
  grooming: /groom|trim|美容|修毛/i,
  bath: /bath|wash|洗澡/i,
  playtime: /play|enrich|玩/i,
  training: /train|训练/i,
};

/** Add-ons a parent would ask for by name; medication handling is a safety line, not a choice. */
const bookableOffers = (offers: AddOnOffer[]): AddOnOffer[] =>
  offers.filter((offer) => Object.values(ADD_ON_NAME).some((pattern) => pattern.test(offer.name)));

const previewAddOn = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
): Promise<StayChangeTurn> => {
  const copy = COPY[ctx.language];
  try {
    const catalogue = await ctx.deps.listAddOns(ctx.ownerId, target.booking_id);
    const offers = bookableOffers(catalogue.offers);
    if (offers.length === 0 || catalogue.days.length === 0) return said(copy.addOnNone);
    const offer = request.addOn
      ? offers.find((candidate) => ADD_ON_NAME[request.addOn as AddOnWord].test(candidate.name))
      : undefined;
    if (!offer) {
      return {
        reply: copy.addOnChoices(offers.map((candidate) => candidate.name)),
        quickReplies: offers.map((candidate) => copy.addOnQuickReply(candidate.name)),
        pending: null,
      };
    }
    const date =
      request.date ?? (catalogue.days.includes(ctx.today) ? ctx.today : catalogue.days[0]);
    if (!date || !catalogue.days.includes(date)) return said(copy.addOnDays(catalogue.days));
    const pet = target.pet_names[0] ?? '';
    const reply = copy.addOnPreview(offer.name, pet, date, offer.price, catalogue.settlement);
    return quote(ctx, reply, {
      ...emptyPending(ctx.now),
      kind: 'add_on',
      booking_id: target.booking_id,
      booking_pet_ids: target.booking_pet_ids,
      pet_names: target.pet_names,
      service_id: offer.serviceId,
      service_name: offer.name,
      service_date: date,
      amount: offer.price,
      request,
    });
  } catch (error: unknown) {
    return refusal(ctx, error);
  }
};

const previewCancel = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
): Promise<StayChangeTurn> => {
  try {
    const preview = await ctx.deps.previewCancellation(ctx.ownerId, target.booking_id);
    return quote(ctx, COPY[ctx.language].cancelPreview(target.pet_names, preview.fee), {
      ...emptyPending(ctx.now),
      kind: 'cancel',
      booking_id: target.booking_id,
      booking_pet_ids: target.booking_pet_ids,
      pet_names: target.pet_names,
      amount: preview.fee,
      request,
    });
  } catch (error: unknown) {
    return refusal(ctx, error);
  }
};

const MS_PER_DAY = 86_400_000;

const previewMove = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
  stay: StayOption,
): Promise<StayChangeTurn> => {
  if (!request.date) {
    return {
      reply: COPY[ctx.language].askNewDates,
      quickReplies: null,
      pending: {
        ...emptyPending(ctx.now),
        stage: 'ask_when',
        booking_id: target.booking_id,
        booking_pet_ids: target.booking_pet_ids,
        pet_names: target.pet_names,
        request,
      },
    };
  }
  // One new date keeps the stay's length: "move it to the 25th" means the same nights from then.
  const [first] = stay.rows;
  const nights = first?.dropOffTime
    ? Math.max(
        1,
        Math.round(
          (Date.parse(`${newZealandDateOf(stay.pickUpAt)}T00:00:00Z`) -
            Date.parse(`${newZealandDateOf(first.dropOffTime)}T00:00:00Z`)) /
            MS_PER_DAY,
        ),
      )
    : 1;
  const endDate = request.endDate ?? addDays(request.date, nights);
  try {
    const preview = await ctx.deps.previewReschedule(ctx.ownerId, target.booking_id, {
      startDate: request.date,
      endDate,
    });
    return quote(
      ctx,
      COPY[ctx.language].movePreview(
        target.pet_names,
        preview.startDate,
        preview.endDate,
        preview.nights,
        preview.total,
        preview.paysNow,
      ),
      {
        ...emptyPending(ctx.now),
        kind: 'move_dates',
        booking_id: target.booking_id,
        booking_pet_ids: target.booking_pet_ids,
        pet_names: target.pet_names,
        start_date: preview.startDate,
        end_date: preview.endDate,
        amount: preview.total,
        request,
      },
    );
  } catch (error: unknown) {
    return refusal(ctx, error);
  }
};

/** Prices the request for one stay, or says why it cannot be done. */
const previewFor = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  target: StayChangeChoice,
  stay: StayOption,
): Promise<StayChangeTurn> => {
  const copy = COPY[ctx.language];
  const currentEnd = newZealandDateOf(stay.pickUpAt);
  const currentTime = formatNewZealandTime(stay.pickUpAt);

  if (request.intent === 'cancel') return previewCancel(ctx, request, target);
  if (request.intent === 'move_dates') return previewMove(ctx, request, target, stay);

  if (request.intent === 'pick_up') {
    const date = request.date ?? currentEnd;
    if (!stay.underWay) {
      // Before arrival only the time of day can move here; dates move through Change dates.
      if (date !== currentEnd) return said(copy.notStartedDates);
    } else if (date > currentEnd) {
      return previewExtend(ctx, request, target, stay, date);
    } else if (date < currentEnd) {
      return said(copy.earlyCheckOut);
    }
    if (!request.time || request.time === currentTime) {
      return said(copy.alreadyThen(instantOf(stay.pickUpAt, ctx.language)));
    }
    return previewTime(ctx, request, target, currentEnd, request.time);
  }

  if (!stay.underWay) return said(copy.noStayUnderWay);

  if (request.intent === 'extend') {
    const endDate = request.date ?? addDays(currentEnd, request.nights ?? 1);
    return previewExtend(ctx, request, target, stay, endDate);
  }

  if (request.intent === 'early_check_out') return said(copy.earlyCheckOut);

  return previewAddOn(ctx, request, target);
};

/** Finds the stay for a request and prices it, or asks which pet or stay it is for. */
const handleRequest = async (
  ctx: TurnContext,
  request: StayChangeRequest,
  chosen: StayChangeChoice | null,
): Promise<StayChangeTurn> => {
  const copy = COPY[ctx.language];
  const rows = await ctx.deps.listBookings(ctx.ownerId);
  const stays = openStays(rows, ctx.now);
  const candidates = isBeforeTheStay(request)
    ? notStartedStays(rows, ctx.now)
    : request.intent === 'pick_up'
      ? stays
      : stays.filter((stay) => stay.underWay);
  if (candidates.length === 0) {
    if (isBeforeTheStay(request)) {
      return said(stays.some((stay) => stay.underWay) ? copy.alreadyStarted : copy.noStay);
    }
    return said(request.intent === 'pick_up' ? copy.noStay : copy.noStayUnderWay);
  }
  const target = chosen ?? pickTarget(ctx, request, candidates);
  if ('reply' in target) return target;
  const stay = candidates.find((candidate) => candidate.bookingId === target.booking_id);
  if (!stay) return said(copy.noStayUnderWay);
  return previewFor(ctx, request, target, stay);
};

/** Makes the quoted change, with the amount the parent was shown. */
const applyChange = async (
  ctx: TurnContext,
  pending: PendingStayChange,
): Promise<StayChangeTurn> => {
  const copy = COPY[ctx.language];
  const bookingId = pending.booking_id ?? '';
  const amount = pending.amount ?? 0;
  try {
    // A change to a stay under way is a request for our manager (stay-change-requests.ts); this
    // reply is the parent's receipt, so the request itself is not announced in the chat again.
    if (pending.kind === 'extend' && pending.end_date) {
      const request = await ctx.deps.requestExtension(
        ctx.ownerId,
        bookingId,
        { endDate: pending.end_date, expectedAmount: amount },
        { announceInChat: false },
      );
      return said(copy.changeRequested(request.summary));
    }
    if (pending.kind === 'add_on' && pending.service_id && pending.service_date) {
      const request = await ctx.deps.requestAddOn(
        ctx.ownerId,
        bookingId,
        pending.booking_pet_ids[0] ?? '',
        {
          serviceId: pending.service_id,
          date: pending.service_date,
          quantity: 1,
          expectedAmount: amount,
        },
        { announceInChat: false },
      );
      return said(copy.changeRequested(request.summary));
    }
    if (pending.kind === 'cancel') {
      const result = await ctx.deps.cancelByGuest(ctx.ownerId, bookingId, { expectedFee: amount });
      return said(copy.cancelDone(result.fee));
    }
    if (pending.kind === 'move_dates' && pending.start_date && pending.end_date) {
      const result = await ctx.deps.rescheduleByGuest(ctx.ownerId, bookingId, {
        startDate: pending.start_date,
        endDate: pending.end_date,
        expectedTotal: amount,
      });
      return said(copy.moveDone(result.startDate, result.endDate, result.held));
    }
    if (pending.kind === 'pick_up_time' && pending.pick_up_time && pending.pick_up_date) {
      const summaries: string[] = [];
      for (const bookingPetId of pending.booking_pet_ids) {
        const request = await ctx.deps.requestTimes(
          ctx.ownerId,
          bookingId,
          bookingPetId,
          { pickUpTime: pending.pick_up_time },
          { announceInChat: false },
        );
        summaries.push(request.summary);
      }
      return said(copy.changeRequested(summaries.join('; ')));
    }
    return said(copy.nothingChanged);
  } catch (error: unknown) {
    if (error instanceof AppError && PRICE_CHANGED_CODES.has(error.code)) {
      // The price moved between the quote and the yes: quote the new one, charge nothing.
      const [detail] = error.details ?? [];
      const newAmount =
        typeof detail === 'object' && detail !== null && 'amount' in detail
          ? Number((detail as { amount: unknown }).amount)
          : null;
      if (newAmount !== null && Number.isFinite(newAmount)) {
        return quote(ctx, copy.priceChanged(newAmount), {
          ...pending,
          amount: newAmount,
          created_at: ctx.now.toISOString(),
        });
      }
    }
    return refusal(ctx, error);
  }
};

const isLive = (pending: PendingStayChange | null, now: Date): pending is PendingStayChange =>
  pending !== null && now.getTime() - Date.parse(pending.created_at) < PENDING_STAY_CHANGE_TTL_MS;

const choiceIn = (text: string, choices: StayChangeChoice[]): StayChangeChoice | null => {
  const trimmed = text.trim().toLowerCase();
  return (
    choices.find((choice) => choice.label.toLowerCase() === trimmed) ??
    choices.find((choice) => choice.pet_names.some((name) => mentions(text, name))) ??
    null
  );
};

/**
 * One chat turn about a stay change, or null when the message is not about one (the normal chat
 * answers it, and any change waiting for a yes is dropped).
 */
export const runStayChangeTurn = async (
  input: StayChangeTurnInput,
  dependencies: StayChangeDependencies = {},
): Promise<StayChangeTurn | null> => {
  const now = (dependencies.now ?? ((): Date => new Date()))();
  const ctx: TurnContext = {
    ownerId: input.ownerId,
    text: input.userMessage,
    language: input.language,
    now,
    today: newZealandDateOf(now),
    deps: {
      listBookings: dependencies.listBookings ?? listBookingsForOwner,
      previewExtension: dependencies.previewExtension ?? previewExtension,
      requestExtension: dependencies.requestExtension ?? requestExtension,
      listAddOns: dependencies.listAddOns ?? listAddOns,
      requestAddOn: dependencies.requestAddOn ?? requestAddOn,
      requestTimes: dependencies.requestTimes ?? requestTimes,
      previewCancellation: dependencies.previewCancellation ?? previewCancellation,
      cancelByGuest: dependencies.cancelByGuest ?? cancelByGuest,
      previewReschedule: dependencies.previewReschedule ?? previewReschedule,
      rescheduleByGuest: dependencies.rescheduleByGuest ?? rescheduleByGuest,
      claimPending: dependencies.claimPending ?? null,
    },
  };
  const copy = COPY[ctx.language];
  const pending = isLive(input.pending, now) ? input.pending : null;
  const request = parseStayChange(input.userMessage, ctx.today);

  if (pending) {
    if (isDecline(input.userMessage) && !request) return said(copy.nothingChanged);
    if (pending.stage === 'confirm' && isConfirmation(input.userMessage)) {
      if (ctx.deps.claimPending && !(await ctx.deps.claimPending())) return said(copy.alreadyTaken);
      return applyChange(ctx, pending);
    }
    if (pending.stage === 'choose_pet' && pending.request && !request) {
      const chosen = choiceIn(input.userMessage, pending.choices);
      if (chosen) return handleRequest(ctx, pending.request, chosen);
    }
    if (pending.stage === 'ask_when' && pending.request?.intent === 'move_dates' && !request) {
      const [start, end] = parseDateRange(input.userMessage, ctx.today);
      if (start) {
        const target: StayChangeChoice = {
          label: namesOf(pending.pet_names, ctx.language),
          booking_id: pending.booking_id ?? '',
          booking_pet_ids: pending.booking_pet_ids,
          pet_names: pending.pet_names,
        };
        return handleRequest(ctx, { ...pending.request, date: start, endDate: end }, target);
      }
    }
  }

  if (!request) return null;
  return handleRequest(ctx, request, null);
};

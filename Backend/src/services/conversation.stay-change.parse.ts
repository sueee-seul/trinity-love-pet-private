/**
 * Reads a parent's chat message for a change to a stay that is under way (Scenario 11 outcome 5:
 * "can I extend the stay by one night?", add-ons, a new check-out time), in English or Chinese. A
 * request to leave early is read too, so the chat can say it is arranged with the team. Pure, so every phrase is unit-tested without a database or a model.
 *
 * Reading is deliberately narrow. A change moves money on a saved card, so a message only counts
 * as a request when it says so plainly ("extend", "add a walk", "check out at 3pm instead"); a
 * question such as "did Bella have a walk?" or "what time is check-out?" is left to
 * the normal chat. Whatever is read here is only ever previewed: nothing changes until the parent
 * confirms the exact amount (conversation.stay-changes.ts).
 */

import type {
  AddOnWord,
  StayChangeIntent,
  StayChangeRequest,
} from '../models/conversation.model.js';

export type { AddOnWord, StayChangeIntent, StayChangeRequest };

const EXTEND =
  /\b(?:extend|extension|stay (?:a (?:bit|little|few days?) )?longer|keep (?:\w+ )?(?:there |here )?(?:a bit |a little )?longer|(?:another|an extra|one more|1 more|a few more|\w+ more|\d+ more|\w+ extra|\d+ extra) nights?)\b|延长|多住|多待|再住|续住|晚几天(?:来)?接|多寄养/i;

const EARLY =
  /\b(?:pick(?:ing)? (?:\w+ )?up (?:\w+ )?(?:early|earlier|sooner)|early pick-?ups?|check(?:ing)?[- ]out (?:early|earlier|sooner)|early check-?outs?|collect(?:ing)? (?:\w+ )?(?:early|earlier|sooner)|come (?:back|home) (?:early|earlier|sooner)|cut (?:the|our|my|\w+'s) stay short|end (?:the|our|my) stay early|leave (?:early|earlier))\b|提前接|早点接|提早接|提前领|提前取|提前回|提前结束|早几天接|提前离店|早点离店/i;

const ADD_ON_VERB =
  /\b(?:add|book|get|arrange|schedule|organi[sz]e|give (?:\w+ )?(?:a|an)|(?:want|like|need) (?:\w+ )?(?:a|an|to have|to get)|can (?:\w+ )?(?:have|get) (?:a|an)|extra|another|one more)\b/i;
const ADD_ON_ZH = /(?:加|多|安排|预约|预订|订|帮(?:他|她|它)?(?:做|约)?|想要|再来)/;

const ADD_ON_WORDS: readonly [AddOnWord, RegExp][] = [
  ['walk', /\bwalks?\b|散步|遛狗|遛弯|遛一遛|溜一圈/i],
  ['grooming', /\bgroom(?:ing|ed)?\b|\bhair ?cut\b|\btrim\b|美容|修毛|剪毛/i],
  ['bath', /\bbath(?:e|ed)?\b|\bwash(?:ed)?\b|洗澡|洗一洗/i],
  ['playtime', /\bplay ?(?:time|session|group)?\b|\benrichment\b|玩耍|陪玩|玩一会/i],
  ['training', /\btraining(?: session)?\b|训练/i],
];

/** "Cancel the booking", "取消这次预订": the whole stay, before it starts. */
const CANCEL =
  /\bcancel\b.{0,30}\b(?:stay|booking|reservation|request|trip)\b|\bwithdraw\b.{0,20}\b(?:request|booking)\b|取消.{0,6}(?:预订|预约|住宿|订单|寄养|申请)|不住了/i;

/** "Move the booking to 20 to 23 October", "改期到10月20日": new dates for a stay not started. */
const MOVE_DATES =
  /\b(?:change|move|reschedule|shift|push (?:back|out)|bring forward)\b.{0,30}\b(?:dates?|booking|stay|reservation)\b|\bdifferent dates\b|改(?:一下)?日期|改期|换(?:个)?日期|日期改|推迟到|延后到/i;

/** "Check out at 3pm instead", "离店时间改到下午三点": a change to the check-out itself. */
const PICK_UP =
  /\bpick(?:ing)?[- ]?(?:\w+ )?up\b|\bcheck(?:ing)?[- ]?out\b|\bcollect(?:ing)?\b|离店|来接|去接|接回|接走|接(?:他|她|它|它们)|接宠|取回|领回|接的时间|几点接/i;
const CHANGE_WORD =
  /\b(?:change|move|switch|instead|make it|reschedul\w*|can (?:i|we)|could (?:i|we)|i'?ll|i will|we'?ll|we will|i'?d like|i want|we want|want to|going to|is it ok|would it be ok)\b|改|换|调整|推迟|能不能|可不可以|可以|我想|我要|我们想|会在|会/i;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  another: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
};

const toNumber = (word: string): number | null => {
  const lower = word.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return NUMBER_WORDS[lower] ?? null;
};

/** "two more nights", "another night", "多住两晚", "延长3天". */
export const parseNights = (text: string): number | null => {
  const english =
    /\b(\d+|a|an|one|two|three|four|five|six|seven|another)\s+(?:more\s+|extra\s+)?nights?\b/i.exec(
      text,
    );
  if (english?.[1]) return toNumber(english[1]);
  const chinese = /(\d+|一|两|二|三|四|五|六|七)\s*(?:个)?(?:晚|夜|天)/.exec(text);
  if (chinese?.[1]) return toNumber(chinese[1]);
  return null;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const WEEKDAYS_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/**
 * Whole weekday names or their usual short forms, so "friendly" is not a Friday; "sun" and "sat"
 * only in full, since "in the sun" and "she sat" are not days.
 */
const WEEKDAY_EN =
  /\b(sunday|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday)\b/;
/** Whole month names or their short forms only, so "octopus" is not October. */
const MONTH_NAME =
  '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|t|tember|ober|ember)?';
const WEEKDAYS_ZH: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

const pad = (value: number): string => String(value).padStart(2, '0');

const isoOf = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const weekdayOf = (isoDate: string): number => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

/** The next date on that weekday, after today (a weekday named on its own day means next week). */
const nextWeekday = (today: string, weekday: number): string => {
  const ahead = (weekday - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, ahead);
};

/** A day and month without a year: this year, or next year once this year's has passed. */
const upcoming = (today: string, month: number, day: number): string | null => {
  const year = Number(today.slice(0, 4));
  const thisYear = isoOf(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return isoOf(year + 1, month, day);
};

/**
 * The date a message names, as a New Zealand calendar date: today, tomorrow, a weekday, "16 Oct",
 * "October 16", "16/10" (day first, as written in New Zealand), "10月16日" or an ISO date.
 */
export const parseDate = (text: string, today: string): string | null => {
  const lower = text.toLowerCase();
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(lower);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (/\bday after tomorrow\b|后天/.test(lower)) return addDays(today, 2);
  if (/\btomorrow\b|明天|明日/.test(lower)) return addDays(today, 1);
  if (/\btoday\b|\btonight\b|今天|今晚|今日/.test(lower)) return today;

  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_NAME}\\b`).exec(lower);
  if (dayMonth) return upcoming(today, MONTHS[dayMonth[2] ?? ''] ?? 0, Number(dayMonth[1]));
  // "May 2" is a date, but in "may 2 more nights" or "may 3pm" it is the verb.
  const monthDay = new RegExp(
    `\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:more|extra|nights?|days?|hours?|[ap]\\.?m\\b|:|\\.\\d))`,
  ).exec(lower);
  if (monthDay) return upcoming(today, MONTHS[monthDay[1] ?? ''] ?? 0, Number(monthDay[2]));
  const chinese = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/.exec(lower);
  if (chinese) return upcoming(today, Number(chinese[1]), Number(chinese[2]));
  const slashed = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(lower);
  if (slashed) {
    const [, day, month, year] = slashed;
    if (year) {
      const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
      return isoOf(fullYear, Number(month), Number(day));
    }
    return upcoming(today, Number(month), Number(day));
  }

  const weekdayEn = WEEKDAY_EN.exec(lower);
  if (weekdayEn) return nextWeekday(today, WEEKDAYS_EN.indexOf((weekdayEn[1] ?? '').slice(0, 3)));
  const weekdayZh = /(?:周|星期|礼拜)([一二三四五六日天])/.exec(lower);
  if (weekdayZh) return nextWeekday(today, WEEKDAYS_ZH[weekdayZh[1] ?? ''] ?? 0);
  return null;
};

const CHINESE_HOURS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

const clockOf = (hour: number, minute: number): string | null =>
  hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? `${pad(hour)}:${pad(minute)}` : null;

/** The time a message names: "3pm", "3:30 pm", "15:00", "noon", "下午3点", "三点半". */
export const parseTime = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (/\bnoon\b|\bmidday\b|中午12点|中午十二点/.test(lower)) return '12:00';
  const meridiem = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/.exec(lower);
  if (meridiem) {
    const hour = Number(meridiem[1]) % 12;
    const isPm = (meridiem[3] ?? '').startsWith('p');
    return clockOf(isPm ? hour + 12 : hour, Number(meridiem[2] ?? 0));
  }
  const twentyFour = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(lower);
  if (twentyFour) return clockOf(Number(twentyFour[1]), Number(twentyFour[2]));
  const chinese =
    /(上午|早上|早晨|中午|下午|傍晚|晚上)?\s*(\d{1,2}|十[一二]?|[一二两三四五六七八九十])\s*[点點](半|(\d{1,2})\s*分?)?/.exec(
      lower,
    );
  if (chinese) {
    const [, part, hourWord = '', half, minutes] = chinese;
    // "快一点" or "早一点接" means "a little", not one o'clock.
    if (!part && hourWord === '一') return null;
    let hour = /^\d+$/.test(hourWord) ? Number(hourWord) : (CHINESE_HOURS[hourWord] ?? -1);
    if ((part === '下午' || part === '傍晚' || part === '晚上') && hour < 12) hour += 12;
    if (part === '中午' && hour < 11) hour += 12;
    return clockOf(hour, half === '半' ? 30 : Number(minutes ?? 0));
  }
  return null;
};

const addOnIn = (text: string): AddOnWord | null =>
  ADD_ON_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

/**
 * The change a message asks for, or null when it asks for none. `today` is today's date in New
 * Zealand, so "tomorrow" and weekdays resolve against the facility's calendar.
 */
/**
 * The dates a message names in order, as a range: "20 to 23 October", "20/10 - 23/10",
 * "10月20日到10月23日". A month written once ("20 to 23 October") carries to the first date.
 */
export const parseDateRange = (text: string, today: string): [string | null, string | null] => {
  const parts = text.split(/\s+(?:to|until|till|through|and)\s+|\s*[-–—]\s*(?=\d)|到|至/i);
  const parsed = parts.map((part) => parseDate(part, today));
  const dates: string[] = [];
  parts.forEach((part, index) => {
    const date = parsed[index];
    if (date) {
      dates.push(date);
      return;
    }
    // "20 to 23 October": a bare day borrows the month (and year) of the next date; "30 to 2
    // November" is the month before.
    const bare = /(?:^|\s)(\d{1,2})(?:st|nd|rd|th)?\s*$/i.exec(part);
    const next = parsed.slice(index + 1).find((later): later is string => later !== null);
    if (!bare?.[1] || !next) return;
    const year = Number(next.slice(0, 4));
    const month = Number(next.slice(5, 7));
    const sameMonth = isoOf(year, month, Number(bare[1]));
    if (sameMonth && sameMonth < next) {
      dates.push(sameMonth);
      return;
    }
    const before =
      month === 1 ? isoOf(year - 1, 12, Number(bare[1])) : isoOf(year, month - 1, Number(bare[1]));
    if (before) dates.push(before);
  });
  return [dates[0] ?? null, dates[1] ?? null];
};

export const parseStayChange = (text: string, today: string): StayChangeRequest | null => {
  const date = parseDate(text, today);
  const time = parseTime(text);
  const base = { date, time, nights: null, addOn: null };
  if (CANCEL.test(text)) return { ...base, intent: 'cancel' };
  if (MOVE_DATES.test(text)) {
    const [start, end] = parseDateRange(text, today);
    return { ...base, intent: 'move_dates', date: start, endDate: end };
  }
  if (EARLY.test(text)) return { ...base, intent: 'early_check_out' };
  if (EXTEND.test(text)) return { ...base, intent: 'extend', nights: parseNights(text) };
  const addOn = addOnIn(text);
  if (addOn && (ADD_ON_VERB.test(text) || ADD_ON_ZH.test(text))) {
    return { ...base, intent: 'add_on', addOn };
  }
  // A check-out on another day or at another time; the stay's own dates decide what it means.
  if (PICK_UP.test(text) && CHANGE_WORD.test(text) && (date !== null || time !== null)) {
    return { ...base, intent: 'pick_up' };
  }
  return null;
};

/** The whole message is a yes, optionally with "please" or "thanks"; "yes, but..." is not. */
const CONFIRM =
  /^\s*(?:yes|yep|yeah|yup|ok|okay|sure|confirm(?:ed)?|go ahead|do it|please do|sounds good|that'?s fine|book it|是|是的|好|好的|好啊|确认|确定|可以|行|没问题|对|嗯|同意)(?:[\s,，]*(?:please|thanks|thank you|谢谢))?[\s!.。！]*$/i;
const DECLINE =
  /^\s*(?:(?:no|nope|nah|cancel|don'?t|do not|stop|never ?mind|not now|leave it)\b|不用|不要|取消|算了|先不|暂时不|不了|不)/i;

/** A plain yes to the change just quoted ("yes", "confirm", "好的", "确认"). */
export const isConfirmation = (text: string): boolean => CONFIRM.test(text.trim());

/** A plain no ("no", "cancel", "不用了", "取消"). */
export const isDecline = (text: string): boolean => DECLINE.test(text.trim());

import type { PortalLocale } from '../i18n/portalLocale';
import { STAY_STATUS_COPY } from '../components/stays/stayStatus';
import type { StayStatus } from '../types/stays';

/*
 * The chat server writes a few fixed words in English: the quick replies it offers and the stay
 * labels and statuses on the pet cards. A quick reply is sent back exactly as offered, because the
 * server matches it word for word, so only what is shown changes here, never what is sent.
 * Anything not recognised is shown as the server wrote it.
 */

/** The quick replies the chat offers itself (conversation.resolver.ts and ConversationArea). */
const FIXED_REPLIES_IN_CHINESE: Readonly<Record<string, string>> = {
  'Check my pet status.': '查看我的宠物状态。',
  'All my pets': '我所有的宠物',
  'All stays': '所有住宿',
};

/** The tags `stayLabel` adds for an approved stay; other stays carry their status words. */
const APPROVED_STAY_TAGS: Readonly<Record<string, StayStatus>> = {
  current: 'staying_now',
  upcoming: 'approved',
  past: 'stay_ended',
};

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "Sep 8-10 (current)" or "Sep 28 - Oct 2 (waiting for review)". */
const STAY_LABEL =
  /^([A-Z][a-z]{2}) (\d{1,2})(?:-(\d{1,2})| - ([A-Z][a-z]{2}) (\d{1,2})) \((.+)\)$/;

const statusOfEnglishWords = (words: string): StayStatus | null => {
  const wanted = words.trim().toLowerCase();
  const match = Object.entries(STAY_STATUS_COPY.en).find(
    ([, label]) => label.toLowerCase() === wanted,
  );
  return match ? (match[0] as StayStatus) : (APPROVED_STAY_TAGS[wanted] ?? null);
};

/** A stay status the server wrote in English ("Waiting for review"), in the reader's language. */
export const stayStatusText = (words: string, locale: PortalLocale): string => {
  const status = locale === 'zh' ? statusOfEnglishWords(words) : null;
  return status ? STAY_STATUS_COPY.zh[status] : words;
};

const chineseDay = (month: string, day: string): string | null => {
  const index = SHORT_MONTHS.indexOf(month);
  return index < 0 ? null : `${index + 1}月${Number(day)}日`;
};

/** A stay label such as "Sep 8-10 (current)", in the reader's language. */
export const stayLabelText = (label: string, locale: PortalLocale): string => {
  if (locale !== 'zh') return label;
  const match = STAY_LABEL.exec(label);
  if (!match) return label;
  const [, startMonth, startDay, sameMonthEnd, endMonth, endDay, tag] = match;
  const start = chineseDay(startMonth, startDay);
  const end = sameMonthEnd ? `${Number(sameMonthEnd)}日` : chineseDay(endMonth, endDay);
  const status = statusOfEnglishWords(tag);
  if (!start || !end || !status) return label;
  return `${start}至${end}（${STAY_STATUS_COPY.zh[status]}）`;
};

/** The questions the chat asks in fixed words (conversation.ai.service.ts and the resolver). */
const FIXED_QUESTIONS_IN_CHINESE: Readonly<Record<string, string>> = {
  'Which pet are you asking about?': '你想问的是哪一只宠物？',
  'Would you like information about a specific pet, or an overview of all your pets?':
    '你想了解某一只宠物，还是查看所有宠物的概况？',
  "Sure! Let's start a new conversation for that.": '好的，我们为这件事开始一个新对话。',
};

const WHICH_STAY_OR_ALL =
  /^Which stay are you referring to for (.+), or would you like information about all stays\? (.+)$/;
const WHICH_STAY = /^Which stay are you referring to for (.+)\?$/;

/**
 * An AI message in the reader's language when it is one of the chat's fixed questions. The
 * model's own answers are asked for in the reader's language, so they need nothing here.
 */
export const aiReplyText = (body: string, locale: PortalLocale): string => {
  if (locale !== 'zh') return body;
  const fixed = FIXED_QUESTIONS_IN_CHINESE[body];
  if (fixed) return fixed;
  const [, petName, options] = WHICH_STAY_OR_ALL.exec(body) ?? [];
  if (petName && options) {
    const stays = options.split(', ').map((label) => stayLabelText(label, locale));
    return `你想问的是 ${petName} 的哪一次住宿，还是想查看所有住宿？${stays.join('、')}`;
  }
  const [, onlyPet] = WHICH_STAY.exec(body) ?? [];
  return onlyPet ? `你想问的是 ${onlyPet} 的哪一次住宿？` : body;
};

/** A quick reply, or a parent's message that was one, in the reader's language. */
export const quickReplyText = (reply: string, locale: PortalLocale): string => {
  if (locale !== 'zh') return reply;
  return FIXED_REPLIES_IN_CHINESE[reply] ?? stayLabelText(reply, locale);
};

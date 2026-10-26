import type { NotificationLocale } from '../contracts/notification.preferences.contract.js';
import { NEW_ZEALAND_TIME_ZONE } from '../common/utils/new-zealand-time.js';
import type { TaskMediaKind } from './task.media.js';

/**
 * The sentences of the daily update, the arrival note and the stay report, in each language a
 * parent can choose. The composer decides what is true from the records; these decide the words.
 * English is what every parent got before preferences existed, so its sentences are unchanged.
 */

export type SummaryLocale = NotificationLocale;

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const EN_DAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const EN_TIME = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const ZH_DAY = new Intl.DateTimeFormat('zh-CN', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});
const ZH_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  parts.find((item) => item.type === type)?.value ?? '';

/** The Chinese month-day with the weekday, e.g. "13 Dec (Sun)". */
const zhDay = (instant: Date): string => {
  const parts = ZH_DAY.formatToParts(instant);
  return `${part(parts, 'month')}月${part(parts, 'day')}日（${part(parts, 'weekday')}）`;
};

/** The Chinese time with its "afternoon" word, e.g. "6:05 pm". */
const zhTime = (instant: Date): string => {
  const parts = ZH_TIME.formatToParts(instant);
  return `${part(parts, 'dayPeriod')}${part(parts, 'hour')}:${part(parts, 'minute')}`;
};

/** "5 pm", or the Chinese "5 o'clock in the afternoon", for the arrival note's promise of the full update. */
const enHour = (hour: number): string =>
  hour === 0 ? '12 am' : hour === 12 ? '12 pm' : hour < 12 ? `${hour} am` : `${hour - 12} pm`;
const zhHour = (hour: number): string =>
  hour < 12 ? `上午${hour}点` : hour === 12 ? `中午12点` : `下午${hour - 12}点`;

const ZH_SLOT: Readonly<Record<string, string>> = {
  morning: '早上',
  midday: '中午',
  noon: '中午',
  afternoon: '下午',
  evening: '晚上',
  night: '夜间',
  bedtime: '睡前',
};

const ZH_CARE: Readonly<Record<string, string>> = {
  grooming: '美容',
  bath: '洗澡',
  playtime: '玩耍',
  'extra playtime': '额外玩耍',
  'group playtime': '集体玩耍',
  'outdoor walk': '户外散步',
  walk: '散步',
  'weight check': '称重',
};

/** The arrival note's middle sentence, for the media it carries (or none). */
const EN_ARRIVAL_MEDIA: Readonly<Record<TaskMediaKind | 'none', string>> = {
  photo: ' The first photo is on Live care.',
  video: ' A short video from today is on Live care.',
  none: '',
};
const ZH_ARRIVAL_MEDIA: Readonly<Record<TaskMediaKind | 'none', string>> = {
  photo: '第一张照片已经在“照顾动态”里。',
  video: '今天的一段短视频已经在“照顾动态”里。',
  none: '',
};

export interface SummaryWords {
  dayLabel: (instant: Date) => string;
  time: (instant: Date) => string;
  slot: (slot: string) => string;
  careTitle: (title: string) => string;
  /** "a, b and c" or "a、b、c". */
  list: (items: string[]) => string;
  intro: (petName: string, dayLabel: string) => string;
  mealOne: (petName: string) => string;
  mealsAll: (petName: string, planned: number) => string;
  mealsSome: (petName: string, done: number, planned: number) => string;
  walks: (count: number) => string;
  play: (count: number) => string;
  activity: (list: string) => string;
  doseItem: (name: string, slot: string, time: string) => string;
  dosesGiven: (petName: string, list: string) => string;
  doseNotGiven: (name: string, slot: string, reason: string | null) => string;
  dosesOpen: (open: number, overdue: number) => string;
  staffNote: (note: string) => string;
  /** Toilet breaks recorded today (the scenario's "toileting"). */
  toilet: (petName: string, count: number) => string;
  /** Today's weight check. */
  weight: (petName: string, kg: number) => string;
  photos: (count: number) => string;
  /** The day had a short video; the newest one rides with the update on Live care. */
  video: (petName: string) => string;
  nothingYet: (petName: string) => string;
  arrival: (petName: string, featured: TaskMediaKind | null, digestHour: number) => string;
  report: {
    stay: (petName: string, nights: number, firstDay: string, lastDay: string) => string;
    mealsAll: (planned: number) => string;
    mealsSome: (done: number, planned: number) => string;
    exercise: (walks: number, play: number) => string;
    medication: (given: number, planned: number, notGiven: number, missed: number) => string;
    photos: (count: number) => string;
    noPhotos: string;
  };
}

const EN: SummaryWords = {
  dayLabel: (instant) => EN_DAY.format(instant).replace(',', ''),
  time: (instant) => EN_TIME.format(instant).toLowerCase(),
  slot: (slot) => slot,
  careTitle: (title) => title.toLowerCase(),
  list: (items) =>
    items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`,
  intro: (petName, dayLabel) => `Here is how ${petName}'s day went on ${dayLabel}.`,
  mealOne: (petName) => `${petName} had the planned meal.`,
  mealsAll: (petName, planned) => `${petName} had all ${planned} planned meals.`,
  mealsSome: (petName, done, planned) =>
    `${petName} has had ${done} of ${planned} planned meals so far.`,
  walks: (count) => plural(count, 'walk', 'walks'),
  play: (count) => plural(count, 'play session', 'play sessions'),
  activity: (list) => `Today's care included ${list}.`,
  doseItem: (name, slot, time) => `${name} (${slot}) at ${time}`,
  dosesGiven: (petName, list) => `${petName} had ${list}.`,
  doseNotGiven: (name, slot, reason) =>
    `The ${slot} ${name} was not given${reason ? `: ${reason}` : ''}.`,
  dosesOpen: (open, overdue) =>
    overdue > 0
      ? `${plural(open, 'dose is', 'doses are')} not yet recorded as given; staff have been alerted about ${overdue === 1 ? 'the overdue one' : 'the overdue ones'}.`
      : `${plural(open, 'dose is', 'doses are')} still to come today.`,
  staffNote: (note) => `Staff note: ${note}`,
  toilet: (petName, count) => `${petName} had ${plural(count, 'toilet break', 'toilet breaks')}.`,
  weight: (petName, kg) => `${petName} weighed ${kg} kg at today's weight check.`,
  photos: (count) =>
    `${plural(count, 'photo was', 'photos were')} taken today; you can see them on Live care.`,
  video: (petName) =>
    `There is a short video of ${petName} from today with this update on Live care.`,
  nothingYet: (petName) =>
    `Nothing has been recorded for ${petName} yet today; the team will add care as the day goes on.`,
  arrival: (petName, featured, digestHour) =>
    `${petName} has arrived and is settling in with us.${EN_ARRIVAL_MEDIA[featured ?? 'none']} You will get the full update at ${enHour(digestHour)}.`,
  report: {
    stay: (petName, nights, firstDay, lastDay) =>
      `${petName} stayed with us for ${plural(nights, 'night', 'nights')}, from ${firstDay} to ${lastDay}.`,
    mealsAll: (planned) => `Every planned meal was given (${planned} in all).`,
    mealsSome: (done, planned) => `${done} of ${planned} planned meals were recorded as given.`,
    exercise: (walks, play) =>
      `Exercise: ${plural(walks, 'walk', 'walks')} and ${plural(play, 'play session', 'play sessions')}.`,
    medication: (given, planned, notGiven, missed) =>
      `Medication: ${given} of ${planned} doses recorded as given` +
      (notGiven > 0 ? `, ${notGiven} recorded as not given` : '') +
      (missed > 0 ? `, ${missed} without a record` : '') +
      '. Please share this with your vet if anything was missed.',
    photos: (count) =>
      `${plural(count, 'photo was', 'photos were')} taken during the stay; they stay on Live care.`,
    noPhotos: 'No photos were taken during the stay.',
  },
};

const ZH: SummaryWords = {
  dayLabel: zhDay,
  time: zhTime,
  slot: (slot) => ZH_SLOT[slot.toLowerCase()] ?? slot,
  careTitle: (title) => ZH_CARE[title.toLowerCase()] ?? title,
  list: (items) => items.join('、'),
  intro: (petName, dayLabel) => `这是${petName}${dayLabel}的情况。`,
  mealOne: (petName) => `${petName}吃了计划的那一餐。`,
  mealsAll: (petName, planned) => `${petName}吃完了计划的${planned}餐。`,
  mealsSome: (petName, done, planned) => `${petName}目前吃了计划${planned}餐中的${done}餐。`,
  walks: (count) => `${count}次散步`,
  play: (count) => `${count}次玩耍`,
  activity: (list) => `今天的照护包括${list}。`,
  doseItem: (name, slot, time) => `${name}（${slot}，${time}）`,
  dosesGiven: (petName, list) => `${petName}已服用${list}。`,
  doseNotGiven: (name, slot, reason) =>
    `${slot}的${name}没有给${reason ? `，原因：${reason}` : ''}。`,
  dosesOpen: (open, overdue) =>
    overdue > 0
      ? `还有${open}剂今天尚未记录为已给；工作人员已收到逾期提醒。`
      : `今天还有${open}剂稍后要给。`,
  staffNote: (note) => `工作人员备注：${note}`,
  toilet: (petName, count) => `${petName}今天如厕${count}次。`,
  weight: (petName, kg) => `今天称重，${petName}体重${kg}公斤。`,
  photos: (count) => `今天拍了${count}张照片，可以在“照顾动态”里查看。`,
  video: (petName) => `今天${petName}的一段短视频和这条动态一起放在“照顾动态”里。`,
  nothingYet: (petName) => `今天还没有记录${petName}的照护；团队会在一天中陆续添加。`,
  arrival: (petName, featured, digestHour) =>
    `${petName}已经到了，正在熟悉环境。${ZH_ARRIVAL_MEDIA[featured ?? 'none']}今天${zhHour(digestHour)}会有完整的动态。`,
  report: {
    stay: (petName, nights, firstDay, lastDay) =>
      `${petName}在我们这里住了${nights}晚，从${firstDay}到${lastDay}。`,
    mealsAll: (planned) => `计划的每一餐都给了（共${planned}餐）。`,
    mealsSome: (done, planned) => `计划${planned}餐中有${done}餐记录为已给。`,
    exercise: (walks, play) => `运动：${walks}次散步和${play}次玩耍。`,
    medication: (given, planned, notGiven, missed) =>
      `用药：计划${planned}剂中有${given}剂记录为已给` +
      (notGiven > 0 ? `，${notGiven}剂记录为未给` : '') +
      (missed > 0 ? `，${missed}剂没有记录` : '') +
      '。如有遗漏，请把这份报告给你的兽医看。',
    photos: (count) => `住宿期间拍了${count}张照片，都保存在“照顾动态”里。`,
    noPhotos: '住宿期间没有拍照片。',
  },
};

export const SUMMARY_WORDS: Readonly<Record<SummaryLocale, SummaryWords>> = { en: EN, zh: ZH };

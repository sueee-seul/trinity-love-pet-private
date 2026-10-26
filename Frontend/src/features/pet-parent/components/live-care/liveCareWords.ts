import type { PortalLocale } from '../../i18n/portalLocale';
import type { CareEntry, Category, LiveCareData, StatTile } from '../../types/liveCare';

/*
 * Live care in the reader's language. The server sends care tasks as staff named them, times as
 * "9:00 AM" and fixed English labels, so Chinese renames what it knows. Task titles are matched
 * case-insensitively; a medicine keeps its own name. A title staff typed themselves has no
 * Chinese, so it is shown as its kind of care instead. Staff notes are what staff wrote.
 */

const TASK_TITLES_IN_CHINESE: Readonly<Record<string, string>> = {
  'wellness check': '健康检查',
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  'feeding (morning)': '喂食（早上）',
  'feeding (evening)': '喂食（晚上）',
  'morning potty break': '早上如厕',
  'midday potty break': '中午如厕',
  'evening potty break': '晚上如厕',
  'potty check: litter tray': '如厕检查：猫砂盆',
  'morning walk': '早上散步',
  'evening walk': '晚上散步',
  'outdoor walk': '户外散步',
  'extra playtime': '额外玩耍时间',
  'enrichment play': '益智玩耍',
  'playtime in the yard': '在院子里玩耍',
  grooming: '美容',
  'grooming: bath and brush': '美容：洗澡和梳毛',
  'medication administration': '喂药',
};

/** "Medication: Carprofen": the medicine's name is a name and stays as written. */
const MEDICINE_TITLE = /^medication:\s*(.+)$/i;

const CATEGORIES_IN_CHINESE: Record<Category, string> = {
  potty: '如厕',
  meal: '用餐',
  play: '玩耍',
  solo: '独处活动',
  other: '照护',
};

const STAT_LABELS_IN_CHINESE: Readonly<Record<string, string>> = {
  'Potty Breaks': '如厕',
  'Meals & Meds': '用餐和用药',
  'Play & Activities': '玩耍和活动',
  'Photos Shared': '分享的照片',
};

const CLOCK = /^(\d{1,2}):(\d{2}) (AM|PM)$/;

export const taskTitleText = (title: string, category: Category): string => {
  const known = TASK_TITLES_IN_CHINESE[title.trim().toLowerCase()];
  if (known) return known;
  const medicine = MEDICINE_TITLE.exec(title.trim())?.[1];
  return medicine ? `用药：${medicine}` : CATEGORIES_IN_CHINESE[category];
};

/** "9:00 AM" and "3:30 PM" with the Chinese words for morning and afternoon in front. */
export const clockText = (time: string): string => {
  const [, hour, minute, half] = CLOCK.exec(time) ?? [];
  if (!hour || !minute) return time;
  return `${half === 'AM' ? '上午' : '下午'} ${hour}:${minute}`;
};

const chineseEntry = (entry: CareEntry): CareEntry => ({
  ...entry,
  title: taskTitleText(entry.title, entry.category),
  time: entry.time === null ? null : clockText(entry.time),
});

const chineseStat = (stat: StatTile): StatTile => ({
  ...stat,
  label: STAT_LABELS_IN_CHINESE[stat.label] ?? stat.label,
});

/** The day's care as the reader reads it. English is returned as sent. */
export const liveCareIn = (data: LiveCareData, locale: PortalLocale): LiveCareData =>
  locale === 'en'
    ? data
    : {
        ...data,
        entries: data.entries.map(chineseEntry),
        stats: data.stats.map(chineseStat),
      };

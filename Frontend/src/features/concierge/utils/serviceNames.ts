import type { ConciergeLocale } from '../types';

/**
 * Wagstay's services in Chinese, keyed by the English name staff gave them. The `services` table
 * holds English only, and its ids differ between databases, so the name is the one stable key
 * (owner decision of 2026-10-05: no database change). Matching ignores case and spacing at the
 * ends. A service not listed here keeps its own name, so a new one shows in English until it is
 * added.
 */
const SERVICE_NAMES_IN_CHINESE: Readonly<Record<string, string>> = {
  'standard room': '标准房',
  'deluxe suite': '豪华套房',
  'garden suite': '花园套房',
  'food from home': '自带食物',
  'house food': '店内干粮',
  'fresh food menu': '新鲜餐食',
  'outdoor walk': '户外散步',
  'extra playtime': '额外玩耍时间',
  'medication administration': '喂药服务',
  'grooming: bath and brush': '美容：洗澡和梳毛',
  // What a stay is called when it has no room on file.
  boarding: '寄养',
  'overnight boarding': '过夜寄养',
};

/** A service's name in the reader's language. */
export const serviceNameText = (name: string, locale: ConciergeLocale): string =>
  locale === 'zh' ? (SERVICE_NAMES_IN_CHINESE[name.trim().toLowerCase()] ?? name) : name;

import type { ConciergeLocale } from '../../contracts/concierge.contract.js';
import { removeDashes } from '../../common/utils/plain-punctuation.js';

/**
 * Last line of defence between model text and the guest.
 *
 * The model is told never to state prices, and it is never shown any, but instructions are not a
 * control. Fair Trading Act s13 / ACL s48 make a stated price binding and s9/s18 cover misleading
 * value claims, so any sentence that talks about money (an amount, a currency, a rate per night,
 * a discount, or "cheapest"/"best value") is replaced as a whole with a pointer to the package
 * card, whose number comes from the pricing code. Dropping the sentence rather than the digits
 * means rewordings ("85 a night", "eighty-five dollars", or the same in Chinese) cannot slip through.
 * Plain numbers about dates, nights and pets are left alone.
 *
 * Dashes are removed first, so the price check reads the reply in the words the guest will see.
 */

export const MAX_REPLY_LENGTH = 1200;

const PRICE_POINTER: Record<ConciergeLocale, string> = {
  en: 'You can see the exact price on the package cards.',
  zh: '具体价格以套餐卡片为准。',
};

const NUMBER = String.raw`(?:\d[\d,]*(?:\.\d+)?\s*[kK]?|[零一二两三四五六七八九十百千万]+)`;
const SPELLED_AMOUNT = String.raw`\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]*)+(?:hundred|thousand)?[\s-]*(?:and\s+)?(?:[a-z-]+\s+)?(?:dollars?|bucks)\b`;

/** Anything that names or implies money. One hit and the sentence is replaced. */
const MONEY_SIGNALS: RegExp[] = [
  /[$€£¥￥]/,
  /\b(?:NZD|AUD|USD|EUR|GBP|RMB|CNY)\b/i,
  /\b(?:dollars?|bucks|cents?|NZ\s*dollars?)\b/i,
  new RegExp(SPELLED_AMOUNT, 'i'),
  /元|块钱|刀|纽币|澳币|新西兰元|澳元|人民币|费用是|价格是|收费/,
  // A number tied to a pricing unit: "85 a night", "85/night", "85 per day", "85 total", "85 each".
  // A date such as "15/10" has no unit after the slash, so it is not caught.
  new RegExp(
    String.raw`${NUMBER}\s*(?:\/|per|a|an|each)\s*(?:night|day|stay|week|pet|dog|cat)\b`,
    'i',
  ),
  new RegExp(String.raw`${NUMBER}\s*(?:in total|total|each|all up|all-in)\b`, 'i'),
  // In Chinese, "85 for a night" is a price; "3 nights in all" or "twice a day" is a count, so a
  // unit after the number excludes it.
  new RegExp(
    String.raw`(?:一晚|每晚|每天|一天|共|一共|总共|合计|总价)\s*${NUMBER}(?![\d晚天只个日夜次位])`,
  ),
  new RegExp(String.raw`${NUMBER}\s*(?:一晚|每晚|每天|一天)`),
  // Discounts and value claims.
  /\d+\s*%|\bper\s*cent\b|\bpercent\b/i,
  /\b(?:discount|save|saving|savings|cheap|cheaper|cheapest|best value|bargain|deal|free of charge|half price|affordable)\b/i,
  /打折|折扣|优惠|省钱|便宜|划算|最低价|特价|免费/,
];

const talksAboutMoney = (sentence: string): boolean =>
  MONEY_SIGNALS.some((signal) => signal.test(sentence));

/** Splits one line after sentence punctuation (English or Chinese), keeping the marks. */
const splitSentences = (line: string): string[] =>
  line.split(/(?<=[.!?。！？])\s+|(?<=[。！？])/).filter((part) => part.trim().length > 0);

/** A list item's marker ("- ", "* ", "1. "), kept so the reply still shows as a list. */
const LIST_MARKER = /^(?:[-*•]|\d{1,3}[.)])\s+/;

/**
 * Works line by line, so the page still gets the line breaks and list markers it formats. A line
 * whose every sentence was about money, after the pointer was already given once, disappears
 * rather than leaving a gap that would split a list in two.
 */
export const removePriceMentions = (text: string, locale: ConciergeLocale): string => {
  const separator = locale === 'zh' ? '' : ' ';
  let pointerAdded = false;
  const keptLines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') {
      keptLines.push('');
      continue;
    }
    const marker = LIST_MARKER.exec(line)?.[0] ?? '';
    const kept: string[] = [];
    for (const sentence of splitSentences(line.slice(marker.length))) {
      if (!talksAboutMoney(sentence)) {
        kept.push(sentence.trim());
      } else if (!pointerAdded) {
        kept.push(PRICE_POINTER[locale]);
        pointerAdded = true;
      }
    }
    if (kept.length > 0) keptLines.push(`${marker}${kept.join(separator)}`);
  }
  return keptLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const guardReply = (text: string, locale: ConciergeLocale): string => {
  const plainText = removeDashes(text).trim();
  const withoutPrices = removePriceMentions(plainText, locale) || PRICE_POINTER[locale];
  if (withoutPrices.length <= MAX_REPLY_LENGTH) {
    return withoutPrices;
  }
  return `${withoutPrices.slice(0, MAX_REPLY_LENGTH - 1).trimEnd()}…`;
};

import type { ConciergeLocale, ConciergeNeedField } from '../../contracts/concierge.contract.js';
import type { AmbiguousCare } from './concierge.rules-extract.js';

/**
 * Fixed sentences the concierge says in its own voice: the questions the rules assistant asks, and
 * the messages shown when the model cannot answer. Keeping them here means both assistants ask for
 * a missing detail the same way, and staff can reword them without touching logic.
 */

export const QUESTION_FOR_FIELD: Record<ConciergeLocale, Record<ConciergeNeedField, string>> = {
  en: {
    service:
      'Happy to help. Right now we take boarding bookings online. Shall I plan a boarding stay for you?',
    dates:
      'Which dates are you thinking of? Tell me the check-in and check-out days, for example 12 to 15 October.',
    pets: 'How many pets are coming to stay, and are they dogs or cats?',
    species: 'Is each pet a dog or a cat? It helps us choose the right room.',
    size: 'Is your dog small, medium or large? We use it to pick a comfortable room.',
  },
  zh: {
    service: '很乐意帮你安排。目前线上可以预约寄养，要我帮你规划一次寄养吗？',
    dates: '你打算哪几天寄养？告诉我入住和离店的日期就行，比如 10月12日到10月15日。',
    pets: '这次有几只宠物来住？是狗狗还是猫咪？',
    species: '每只宠物分别是狗狗还是猫咪？这样我们好安排合适的房间。',
    size: '你的狗狗是小型、中型还是大型？我们会据此安排舒适的房间。',
  },
};

export const PACKAGES_READY: Record<ConciergeLocale, string> = {
  en: 'Thanks, that is everything I need. I have put together a few suggested stays for you. Open your stay to see them with the full GST-inclusive price, take one as it is or change any line, then press "Continue with this stay" when you are ready.',
  zh: '好的，信息都齐了。我为你准备了几个推荐方案。打开「我的住宿」就能看到含 GST 的总价，可以直接选用，也可以任意调整每一项，准备好后点「按这个住宿继续」。',
};

const stayDate = (isoDate: string, locale: ConciergeLocale): string =>
  new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));

/** Said when a signed-in parent asks for the same stay as last time and one was found. */
export const LAST_STAY_COPIED: Record<
  ConciergeLocale,
  (petNames: string, startDate: string, datesStillNeeded: boolean) => string
> = {
  en: (petNames, startDate, datesStillNeeded) =>
    `Welcome back! I have copied the stay ${petNames} had with us from ${stayDate(startDate, 'en')}: the same room, food and add-ons are in your stay, and you can change any line.${datesStillNeeded ? ` ${QUESTION_FOR_FIELD.en.dates}` : ''}`,
  zh: (petNames, startDate, datesStillNeeded) =>
    `欢迎回来！我已经把${petNames}在${stayDate(startDate, 'zh')}那次的住宿复制过来了，房间、餐食和加项都和上次一样，每一项都可以再调整。${datesStillNeeded ? QUESTION_FOR_FIELD.zh.dates : ''}`,
};

/** A signed-in parent with no earlier stay on the account. */
export const NO_LAST_STAY: Record<ConciergeLocale, string> = {
  en: `I could not find an earlier stay on this account, so let us start fresh. ${QUESTION_FOR_FIELD.en.pets}`,
  zh: `这个账号下还没有之前的住宿记录，我们从头开始吧。${QUESTION_FOR_FIELD.zh.pets}`,
};

/** A guest who is not signed in cannot have a last stay looked up. */
export const SIGN_IN_FOR_LAST_STAY: Record<ConciergeLocale, string> = {
  en: 'Happy to copy your last stay. Please sign in first with "Booked with us before? Sign in" at the top of the page, then tell me "same as last time" again.',
  zh: '可以照上次的安排。请先用页面上方的「之前订过？登录」登录，然后再和我说一次「和上次一样」。',
};

export const ASSISTANT_UNAVAILABLE: Record<ConciergeLocale, string> = {
  en: 'Sorry, the assistant cannot reply right now. You can keep going with the answer buttons or the checklist on this page, and the options will still appear.',
  zh: '抱歉，助手暂时无法回复。你可以继续点选下方的按钮或使用页面上的清单，方案一样会出现。',
};

export const ASSISTANT_DECLINED: Record<ConciergeLocale, string> = {
  en: 'I can only help with planning a stay here. For anything else, please contact our team directly.',
  zh: '这里我只能帮你安排寄养。其他问题请直接联系我们的工作人员。',
};

/** The rules assistant cannot understand free text beyond keywords, so it says so once. */
export const RULES_NOT_UNDERSTOOD: Record<ConciergeLocale, string> = {
  en: 'I did not quite catch that. You can also tap an answer below.',
  zh: '这句我没太理解，也可以直接点下面的选项。',
};

/** Said when a tap changes details after the options are already showing. */
export const OPTIONS_UPDATED: Record<ConciergeLocale, string> = {
  en: 'Done. Your stay is updated.',
  zh: '好的，你的住宿已经更新。',
};

/** Asked instead of guessing which pet a care detail belongs to. */
export const CARE_CLARIFY: Record<ConciergeLocale, Record<AmbiguousCare, string>> = {
  en: {
    medication:
      'Which pet takes medication? Just tell me (for example "the cat"), or tick "Needs medication" for that pet on the checklist.',
    firstTime:
      'Which pet is staying with us for the first time? Just tell me, or tick "First stay with us" for that pet on the checklist.',
  },
  zh: {
    medication: '是哪一只需要吃药？直接告诉我（比如"猫咪"），或在清单里给那一只勾选"需要吃药"。',
    firstTime: '是哪一只第一次来住？直接告诉我，或在清单里给那一只勾选"第一次来住"。',
  },
};

/** Asked once the options are showing: size helps staff but never holds the price back. */
export const OPTIONAL_SIZE_QUESTION: Record<ConciergeLocale, string> = {
  en: 'One more thing that helps our team choose the room: is your dog small, medium or large?',
  zh: '还有一件事能帮我们安排房间：狗狗是小型、中型还是大型？',
};

/** How many full nights are named before the rest are counted. */
const NAMED_FULL_NIGHTS = 4;

const NIGHT_FORMAT: Record<ConciergeLocale, Intl.DateTimeFormat> = {
  // The nights are calendar dates, so they are formatted in UTC to keep the day as written.
  en: new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  zh: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', timeZone: 'UTC' }),
};

const formatNight = (night: string, locale: ConciergeLocale): string =>
  NIGHT_FORMAT[locale].format(new Date(`${night}T00:00:00Z`));

const listFullNights = (nights: string[], locale: ConciergeLocale): string => {
  const named = nights.slice(0, NAMED_FULL_NIGHTS).map((night) => formatNight(night, locale));
  const others = nights.length - named.length;
  if (locale === 'zh') {
    return others > 0 ? `${named.join('、')}等 ${nights.length} 晚` : named.join('、');
  }
  if (others > 0) {
    return `${named.join(', ')} and ${others} more ${others === 1 ? 'night' : 'nights'}`;
  }
  return named.length > 1
    ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
    : (named[0] ?? '');
};

/** Said instead of the options when some nights of the stay have no room left. */
export const FULLY_BOOKED: Record<ConciergeLocale, (nights: string[]) => string> = {
  en: (nights) =>
    `Sorry, we are full on ${listFullNights(nights, 'en')}. Please try other dates and I will price them for you.`,
  zh: (nights) => `抱歉，${listFullNights(nights, 'zh')}已经住满了。换个日期试试，我再帮你报价。`,
};

/** The basic assistant cannot answer free questions; it keeps them for staff and says so. */
/** A question about fees or terms in rules mode: point to the rules on the page, never guess. */
export const RULES_POLICY_POINTER: Record<ConciergeLocale, string> = {
  en: 'I can’t answer questions about fees or terms in basic mode. The fee rules are shown beside the card details and the full booking terms are on this page; our team can confirm anything else.',
  zh: '基础模式下我无法回答费用或条款方面的问题。费用规则就在银行卡信息旁边，完整的预约条款也在本页上，其他问题可以联系我们的工作人员确认。',
};

export const RULES_NOTED_FOR_TEAM: Record<ConciergeLocale, string> = {
  en: 'I can’t answer that in basic mode, so I’ve added it to your notes for our team.',
  zh: '基础模式下我没法回答这个问题，已经帮你记在给工作人员的备注里了。',
};

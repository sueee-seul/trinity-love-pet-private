// The words the homepage helpers in utils/home.ts write, in every portal language. The helpers stay
// pure (no hooks), so they take a locale and read their text from here. Names, breeds and other
// text the server sends are passed in and never translated.
import type { PortalCopy } from '../i18n/portalLocale';
import type { ChecklistKey, HomePet } from '../types/home';

/** The two ways the homepage joins pet names: "Max and Luna", "Max or Luna". */
export type NameConjunction = 'and' | 'or';

/** Every cell the Quick actions grid can show. */
export type QuickActionKey =
  'stays' | 'pets' | 'book' | 'feedback' | 'profile' | 'add-your-pet' | 'prepare' | 'live-care';

export interface HomeText {
  conjunctions: Record<NameConjunction, string>;
  /** Between every name but the last two. */
  nameSeparator: string;
  /** "Max's"; the result is followed by the thing the pets own. */
  possessive: (joinedNames: string) => string;
  species: Record<HomePet['species'], string>;
  /** The number and its unit never part at a line end (a no-break space). */
  age: (years: number) => string;
  nights: (count: number) => string;
  today: string;
  daysToGo: (days: number) => string;
  daysToGoCompact: (days: number) => string;
  welcome: (firstName: string | null) => string;
  welcomeBack: (firstName: string | null) => string;
  firstStaySubline: string;
  planFirstStaySubline: string;
  nextStaySubline: (petsPossessive: string) => string;
  bookFirstTitle: string;
  bookFirstBody: (joinedNames: string) => string;
  bookAnotherTitle: string;
  bookAnotherBody: string;
  stayComingUp: (petsPossessive: string) => string;
  stayingWithUs: (joinedNames: string, petCount: number) => string;
  pickUpToday: string;
  pickUpTomorrow: string;
  pickUpInDays: (days: number) => string;
  /** The chip's wording: the specific thing still needed, not the checklist row's own label. */
  issueLabels: Partial<Record<ChecklistKey, string>>;
  quickActions: Record<QuickActionKey, string>;
}

const withEnglishName = (greeting: string, firstName: string | null): string =>
  firstName ? `${greeting}, ${firstName}` : greeting;

const withChineseName = (greeting: string, firstName: string | null): string =>
  firstName ? `${greeting}，${firstName}` : greeting;

export const HOME_TEXT: PortalCopy<HomeText> = {
  en: {
    conjunctions: { and: 'and', or: 'or' },
    nameSeparator: ', ',
    possessive: (joinedNames) => `${joinedNames}'s`,
    species: { dog: 'Dog', cat: 'Cat', other: 'Other' },
    age: (years) => `${years}\u00a0${years === 1 ? 'yr' : 'yrs'}`,
    nights: (count) => `${count} ${count === 1 ? 'night' : 'nights'}`,
    today: 'Today',
    daysToGo: (days) => `${days} ${days === 1 ? 'day' : 'days'} to go`,
    daysToGoCompact: (days) => `${days} ${days === 1 ? 'day' : 'days'}`,
    welcome: (firstName) => withEnglishName('Welcome', firstName),
    welcomeBack: (firstName) => withEnglishName('Welcome back', firstName),
    firstStaySubline: "Let's get your pet ready for their first stay.",
    planFirstStaySubline: "Ready to plan your pet's first stay?",
    nextStaySubline: (petsPossessive) => `Ready for ${petsPossessive} next stay?`,
    bookFirstTitle: 'Book a stay',
    bookFirstBody: (joinedNames) => `Choose your dates and services for ${joinedNames}.`,
    bookAnotherTitle: 'Book another stay',
    bookAnotherBody: 'Same pets, same easy setup. Choose your dates and services.',
    stayComingUp: (petsPossessive) => `${petsPossessive} stay is coming up`,
    stayingWithUs: (joinedNames, petCount) =>
      `${joinedNames} ${petCount === 1 ? 'is' : 'are'} staying with us`,
    pickUpToday: 'Check-out today',
    pickUpTomorrow: 'Check-out tomorrow',
    pickUpInDays: (days) => `Check-out in ${days} days`,
    issueLabels: {
      agreement: 'Agreement unsigned',
      payment: 'Payment incomplete',
      vaccination: 'Incomplete vaccination',
    },
    quickActions: {
      stays: 'My stays',
      pets: 'My pets',
      book: 'Book a stay',
      feedback: 'Leave feedback',
      profile: 'Profile',
      'add-your-pet': 'Add your pet',
      prepare: 'Prepare',
      'live-care': "Today's updates",
    },
  },
  zh: {
    conjunctions: { and: '和', or: '或' },
    nameSeparator: '、',
    possessive: (joinedNames) => `${joinedNames} 的`,
    species: { dog: '狗狗', cat: '猫咪', other: '其他' },
    age: (years) => `${years}\u00a0岁`,
    nights: (count) => `${count} 晚`,
    today: '今天',
    daysToGo: (days) => `还有 ${days} 天`,
    daysToGoCompact: (days) => `${days} 天后`,
    welcome: (firstName) => withChineseName('欢迎', firstName),
    welcomeBack: (firstName) => withChineseName('欢迎回来', firstName),
    firstStaySubline: '一起为毛孩子的第一次住宿做好准备吧。',
    planFirstStaySubline: '准备好为毛孩子安排第一次住宿了吗？',
    nextStaySubline: (petsPossessive) => `准备好安排 ${petsPossessive}下一次住宿了吗？`,
    bookFirstTitle: '预订住宿',
    bookFirstBody: (joinedNames) => `为 ${joinedNames} 选好日期和服务。`,
    bookAnotherTitle: '再预订一次住宿',
    bookAnotherBody: '还是这些宠物，设置一样简单。选好日期和服务就行。',
    stayComingUp: (petsPossessive) => `${petsPossessive}住宿快到了`,
    stayingWithUs: (joinedNames) => `${joinedNames} 正住在我们这里`,
    pickUpToday: '今天离店',
    pickUpTomorrow: '明天离店',
    pickUpInDays: (days) => `${days} 天后离店`,
    issueLabels: {
      agreement: '协议未签署',
      payment: '付款未完成',
      vaccination: '疫苗信息不全',
    },
    quickActions: {
      stays: '我的住宿',
      pets: '我的宠物',
      book: '预订住宿',
      feedback: '留下反馈',
      profile: '个人资料',
      'add-your-pet': '添加宠物',
      prepare: '住前准备',
      'live-care': '今日动态',
    },
  },
};

// The words the homepage's components write, in every portal language. Text the helpers in
// utils/home.ts build (greetings, titles, counts, quick actions) is in utils/homeCopy.ts. Pet
// names, service names and the manager's reason come from the server and are passed in as is.
import type { PortalCopy } from '../../i18n/portalLocale';
import type { ChecklistKey } from '../../types/home';

export interface HowItWorksStep {
  title: string;
  body: string;
}

export interface HomeCopy {
  // Page states
  loading: string;
  loadFailed: string;
  tryAgain: string;
  // Hero cards
  createPetTitle: string;
  createPetBody: string;
  addYourPet: string;
  startBooking: string;
  viewPastBookings: string;
  viewBoardingPass: string;
  viewBooking: string;
  prepareForStay: string;
  seeTodaysUpdates: string;
  /**
   * The heading over the hero, named like the side column's "Your pets" so both columns start
   * with a heading at the same height.
   */
  leadTitles: Readonly<Record<'now' | 'next' | 'plan' | 'start', string>>;
  // Before the stay checklist
  beforeTheStay: string;
  checklistDone: string;
  checklistOutstanding: string;
  /** The server words each item in English; English shows that, Chinese its own words. */
  checklistLabels: Readonly<Partial<Record<ChecklistKey, string>>>;
  // Get ready cards
  dropOffAt: (dateTime: string) => string;
  getReadyTitle: (petPossessive: string) => string;
  // Needs your attention
  needsAttention: string;
  refusedRowTitle: (petName: string, dates: string) => string;
  /** The refusal, said by the manager who made it when their name is known. */
  managerSaid: (reason: string, reviewerName: string | null) => string;
  managerRefused: (reviewerName: string | null) => string;
  tryOtherDates: string;
  /** Starts with the visible words, so a voice user can still say them. */
  tryOtherDatesFor: (petName: string) => string;
  // Also coming up
  alsoComingUp: string;
  allSet: string;
  viewAllUpcoming: (count: number) => string;
  // Your pets
  yourPets: string;
  seeAll: string;
  bookAStay: string;
  /** Starts with the visible words, so a voice user can still say them. */
  bookAStayFor: (petName: string) => string;
  addAPet: string;
  // Quick actions
  quickActions: string;
  // How it works (state A)
  howItWorks: string;
  steps: readonly HowItWorksStep[];
}

export const HOME_COPY: PortalCopy<HomeCopy> = {
  en: {
    loading: 'Loading your homepage…',
    loadFailed: 'Something went wrong loading your homepage.',
    tryAgain: 'Try again',
    createPetTitle: 'Create your first pet',
    createPetBody: 'Tell us about your pet so we can provide personalised care during their stay.',
    addYourPet: 'Add your pet',
    startBooking: 'Start a booking',
    viewPastBookings: 'View past bookings',
    viewBoardingPass: 'View boarding pass',
    viewBooking: 'View booking',
    prepareForStay: 'Prepare for stay',
    seeTodaysUpdates: "See today's updates",
    leadTitles: {
      now: 'Right now',
      next: 'Your next stay',
      plan: 'Plan a stay',
      start: 'Get started',
    },
    beforeTheStay: 'Before the stay',
    checklistDone: ' (done)',
    checklistOutstanding: ' (outstanding)',
    checklistLabels: {},
    dropOffAt: (dateTime) => `Check-in ${dateTime}`,
    getReadyTitle: (petPossessive) => `Get ready for ${petPossessive} stay`,
    needsAttention: 'Needs your attention',
    refusedRowTitle: (petName, dates) => `${petName}, ${dates}`,
    managerSaid: (reason, reviewerName) =>
      reviewerName
        ? `${reviewerName}, our manager, said: ${reason}`
        : `Our manager said: ${reason}`,
    managerRefused: (reviewerName) =>
      reviewerName
        ? `${reviewerName}, our manager, could not accept this request.`
        : 'Our manager could not accept this request.',
    tryOtherDates: 'Try other dates',
    tryOtherDatesFor: (petName) => `Try other dates for ${petName}`,
    alsoComingUp: 'Also coming up',
    allSet: 'All set',
    viewAllUpcoming: (count) => `View all upcoming stays (${count})`,
    yourPets: 'Your pets',
    seeAll: 'See all',
    bookAStay: 'Book a stay',
    bookAStayFor: (petName) => `Book a stay for ${petName}`,
    addAPet: 'Add a pet',
    quickActions: 'Quick actions',
    howItWorks: 'How it works',
    steps: [
      { title: 'Create a pet profile', body: 'Breed, age, diet and anything we should know.' },
      { title: 'Book a stay', body: 'Pick your dates and the services you want.' },
      { title: 'Prepare for the visit', body: 'Sign the agreement and confirm vaccinations.' },
      { title: 'Follow their care', body: "Photos and updates while they're with us." },
    ],
  },
  zh: {
    loading: '正在加载首页…',
    loadFailed: '首页加载出错了。',
    tryAgain: '重试',
    createPetTitle: '添加你的第一只宠物',
    createPetBody: '告诉我们宠物的情况，住宿期间我们才能给它贴心的照顾。',
    addYourPet: '添加宠物',
    startBooking: '开始预订',
    viewPastBookings: '查看以往预约',
    viewBoardingPass: '查看住宿凭证',
    viewBooking: '查看预约',
    prepareForStay: '为住宿做准备',
    seeTodaysUpdates: '查看今日动态',
    leadTitles: { now: '现在', next: '下一次住宿', plan: '安排住宿', start: '开始使用' },
    beforeTheStay: '住宿之前',
    checklistDone: '（已完成）',
    checklistOutstanding: '（未完成）',
    checklistLabels: {
      agreement: '已同意预约条款',
      payment: '付款',
      vaccination: '疫苗信息',
      admission: '入住核验',
    },
    dropOffAt: (dateTime) => `入住时间：${dateTime}`,
    getReadyTitle: (petPossessive) => `为 ${petPossessive}住宿做准备`,
    needsAttention: '需要你处理',
    refusedRowTitle: (petName, dates) => `${petName}，${dates}`,
    managerSaid: (reason, reviewerName) =>
      reviewerName ? `经理 ${reviewerName} 说：${reason}` : `经理说：${reason}`,
    managerRefused: (reviewerName) =>
      reviewerName ? `经理 ${reviewerName} 没能接受这次申请。` : '经理没能接受这次申请。',
    tryOtherDates: '换个日期试试',
    tryOtherDatesFor: (petName) => `换个日期试试（${petName}）`,
    alsoComingUp: '其他即将到来的住宿',
    allSet: '都准备好了',
    viewAllUpcoming: (count) => `查看全部即将到来的住宿（${count}）`,
    yourPets: '你的宠物',
    seeAll: '查看全部',
    bookAStay: '预订住宿',
    bookAStayFor: (petName) => `预订住宿（${petName}）`,
    addAPet: '添加宠物',
    quickActions: '快捷操作',
    howItWorks: '使用流程',
    steps: [
      { title: '创建宠物档案', body: '品种、年龄、饮食，以及我们需要知道的一切。' },
      { title: '预订住宿', body: '选好日期和想要的服务。' },
      { title: '做好入住准备', body: '签署协议，确认疫苗情况。' },
      { title: '关注照顾动态', body: '住在我们这里时的照片和动态。' },
    ],
  },
};

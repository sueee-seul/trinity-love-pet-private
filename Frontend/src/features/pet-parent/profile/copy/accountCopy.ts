import type { PortalCopy, PortalLocale } from '../../i18n/portalLocale';

/** The words of the account page (/parent/profile): its header, sidebar and both tabs. */
export interface AccountCopy {
  pageTitle: string;
  pageLead: string;
  loadFailedTitle: string;
  tryAgain: string;
  editProfileTitle: string;
  addPetTitle: string;
  nav: {
    label: string;
    accountHeading: string;
    staysHeading: string;
    settingsHeading: string;
    profileTab: string;
    petsTab: string;
    contactsTab: string;
    updatesTab: string;
    myStays: string;
    accountSettings: string;
  };
  overview: {
    notProvided: string;
    petParentBadge: string;
    email: string;
    phone: string;
    address: string;
    editProfile: string;
    atAGlance: string;
    petCount: (count: number) => string;
    dateOfBirth: string;
    emergencyContact: string;
    petsOnFile: string;
    noPetsYet: string;
    /** Between pet names in a list: a comma in English, the list comma (、) in Chinese. */
    nameSeparator: string;
  };
  pets: {
    heading: string;
    lead: string;
    addPet: string;
    empty: string;
    addFirstPet: string;
    stayingNow: (place: string) => string;
    waitingForReview: (place: string) => string;
    upcoming: (place: string) => string;
    allergyBadge: (allergy: string) => string;
    activeMedicines: (count: number) => string;
    noUpcomingStay: string;
  };
}

export const ACCOUNT_COPY: PortalCopy<AccountCopy> = {
  en: {
    pageTitle: 'My account',
    pageLead: 'Your contact details and the pets you board with Wagstay.',
    loadFailedTitle: 'We could not load your account',
    tryAgain: 'Try again',
    editProfileTitle: 'Edit profile',
    addPetTitle: 'Add a pet',
    nav: {
      label: 'Pet parent account sections',
      accountHeading: 'Account',
      staysHeading: 'Stays',
      settingsHeading: 'Settings',
      profileTab: 'Profile',
      petsTab: 'My pets',
      contactsTab: 'Emergency contacts',
      updatesTab: 'Updates and notifications',
      myStays: 'My stays',
      accountSettings: 'Account settings',
    },
    overview: {
      notProvided: 'Not provided',
      petParentBadge: 'Pet parent',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      editProfile: 'Edit profile',
      atAGlance: 'At a glance',
      petCount: (count) => `${count} ${count === 1 ? 'pet' : 'pets'}`,
      dateOfBirth: 'Date of birth',
      emergencyContact: 'Emergency contact',
      petsOnFile: 'Pets on file',
      noPetsYet: 'None yet',
      nameSeparator: ', ',
    },
    pets: {
      heading: 'My pets',
      lead: 'Open a pet to see or change their details.',
      addPet: 'Add a pet',
      empty: 'You have not added a pet yet.',
      addFirstPet: 'Add your first pet',
      stayingNow: (place) => `Staying at ${place} now`,
      waitingForReview: (place) => `Stay request at ${place} waiting for review`,
      upcoming: (place) => `Upcoming stay at ${place}`,
      allergyBadge: (allergy) => `${allergy} allergy`,
      activeMedicines: (count) => `${count} active ${count === 1 ? 'medicine' : 'medicines'}`,
      noUpcomingStay: 'No upcoming stay',
    },
  },
  zh: {
    pageTitle: '我的账户',
    pageLead: '你的联系方式，以及在 Wagstay 寄养的宠物。',
    loadFailedTitle: '你的账户没有加载出来',
    tryAgain: '重试',
    editProfileTitle: '编辑资料',
    addPetTitle: '添加宠物',
    nav: {
      label: '宠物主人账户栏目',
      accountHeading: '账户',
      staysHeading: '住宿',
      settingsHeading: '设置',
      profileTab: '个人资料',
      petsTab: '我的宠物',
      contactsTab: '紧急联系人',
      updatesTab: '动态与通知',
      myStays: '我的住宿',
      accountSettings: '账户设置',
    },
    overview: {
      notProvided: '未填写',
      petParentBadge: '宠物主人',
      email: '邮箱',
      phone: '电话',
      address: '地址',
      editProfile: '编辑资料',
      atAGlance: '概览',
      petCount: (count) => `${count} 只宠物`,
      dateOfBirth: '出生日期',
      emergencyContact: '紧急联系人',
      petsOnFile: '已登记的宠物',
      noPetsYet: '还没有',
      nameSeparator: '、',
    },
    pets: {
      heading: '我的宠物',
      lead: '打开宠物资料，可以查看或修改详细信息。',
      addPet: '添加宠物',
      empty: '你还没有添加宠物。',
      addFirstPet: '添加第一只宠物',
      stayingNow: (place) => `正在 ${place} 住宿`,
      waitingForReview: (place) => `${place} 的住宿申请正在等待审核`,
      upcoming: (place) => `即将在 ${place} 住宿`,
      allergyBadge: (allergy) => `过敏：${allergy}`,
      activeMedicines: (count) => `正在用药 ${count} 种`,
      noUpcomingStay: '没有即将到来的住宿',
    },
  },
};

/** The words of the save and load notice, and of the dialog frame the account pages share. */
export interface AccountChromeCopy {
  notSaved: string;
  loadingProfile: string;
  closeDialog: string;
}

export const ACCOUNT_CHROME_COPY: PortalCopy<AccountChromeCopy> = {
  en: {
    notSaved: 'Not saved',
    loadingProfile: 'Loading your profile…',
    closeDialog: 'Close',
  },
  zh: {
    notSaved: '没有保存',
    loadingProfile: '正在加载你的资料…',
    closeDialog: '关闭',
  },
};

/**
 * Chinese for the failure sentences the profile client writes itself (repository.ts and
 * parentProfileApi.ts). The sync state carries them as English text. The server's own reasons
 * arrive in English too, so in Chinese a sentence not listed here becomes the general one below.
 */
const SYNC_ERRORS_IN_CHINESE: Readonly<Record<string, string>> = {
  'We could not reach Wagstay. Check your connection, then reload the page.':
    '连接不上 Wagstay。请检查网络，然后刷新页面。',
  'The server rejected the request.': '服务器拒绝了这个请求。',
  'The server sent a profile it could not read': '服务器返回的资料无法读取',
  'Could not load your profile': '你的资料没有加载出来',
  'Could not save your profile': '你的资料没有保存成功',
  'Could not add the pet': '宠物没有添加成功',
  'Could not save the pet': '宠物资料没有保存成功',
  'Could not delete the pet': '宠物没有删除成功',
};

const SYNC_ERROR_FALLBACK_IN_CHINESE = '这一步没有完成，请重试。';

/** The sync error in the reader's language. */
export function localizeSyncError(error: string, locale: PortalLocale): string {
  if (locale === 'en') return error;
  return SYNC_ERRORS_IN_CHINESE[error] ?? SYNC_ERROR_FALLBACK_IN_CHINESE;
}

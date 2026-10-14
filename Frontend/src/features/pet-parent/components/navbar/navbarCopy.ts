import type { PortalCopy } from '../../i18n/portalLocale';

export interface NavbarCopy {
  mainNav: string;
  tabsNav: string;
  logIn: string;
  signUp: string;
  /** The toggle names the other language in that language, so a reader of it can find it. */
  /** The account's name when the profile has none and the session carries no name or email. */
  accountFallbackName: string;
  home: string;
  myStays: string;
  bookAStay: string;
  feedback: string;
  staysTab: string;
  bookTab: string;
  chatTab: string;
  profileTab: string;
}

export const NAVBAR_COPY: PortalCopy<NavbarCopy> = {
  en: {
    mainNav: 'Main',
    tabsNav: 'Tabs',
    logIn: 'Log in',
    signUp: 'Sign up',
    accountFallbackName: 'Pet parent',
    home: 'Home',
    myStays: 'My stays',
    bookAStay: 'Book a stay',
    feedback: 'Feedback',
    staysTab: 'Stays',
    bookTab: 'Book',
    chatTab: 'Chat',
    profileTab: 'Profile',
  },
  zh: {
    mainNav: '主导航',
    tabsNav: '标签栏',
    logIn: '登录',
    signUp: '注册',
    accountFallbackName: '宠物家长',
    home: '首页',
    myStays: '我的住宿',
    bookAStay: '预订住宿',
    feedback: '反馈',
    staysTab: '住宿',
    bookTab: '预订',
    chatTab: '聊天',
    profileTab: '我的',
  },
};

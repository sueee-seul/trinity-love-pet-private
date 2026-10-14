import type { PortalCopy } from '../../i18n/portalLocale';

export interface AccountMenuCopy {
  menuButton: string;
  profile: string;
  leaveFeedback: string;
  accountSettings: string;
  logOut: string;
}

export const ACCOUNT_MENU_COPY: PortalCopy<AccountMenuCopy> = {
  en: {
    menuButton: 'Account menu',
    profile: 'Profile',
    leaveFeedback: 'Leave feedback',
    accountSettings: 'Account settings',
    logOut: 'Log out',
  },
  zh: {
    menuButton: '账户菜单',
    profile: '个人资料',
    leaveFeedback: '留下反馈',
    accountSettings: '账户设置',
    logOut: '退出登录',
  },
};

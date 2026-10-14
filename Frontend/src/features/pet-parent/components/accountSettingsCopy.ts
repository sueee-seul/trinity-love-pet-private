import type { PortalCopy } from '../i18n/portalLocale';

/** The account settings dialog's own words. The appearance controls inside it are shared. */
export interface AccountSettingsCopy {
  title: string;
  close: string;
  contentArea: string;
}

export const ACCOUNT_SETTINGS_COPY: PortalCopy<AccountSettingsCopy> = {
  en: {
    title: 'Account settings',
    close: 'Close account settings',
    contentArea: 'Account settings content area',
  },
  zh: {
    title: '账户设置',
    close: '关闭账户设置',
    contentArea: '账户设置内容',
  },
};

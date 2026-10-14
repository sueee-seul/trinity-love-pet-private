import type { PortalCopy } from '../../i18n/portalLocale';
import type { NotificationLocale } from '../../types/notificationPreferences';

/** The words of the "Updates and notifications" view of the account area. */
export interface NotificationPreferencesCopy {
  title: string;
  loading: string;
  loadFailed: string;
  tryAgain: string;
  language: string;
  /**
   * Each language named in the page's language: the owner's rule is that no Chinese character shows
   * in English mode, so English mode reads "Chinese" and Chinese mode reads "英文".
   */
  languageNames: Record<NotificationLocale, string>;
  languageHint: string;
  digestHour: string;
  digestHint: string;
  quietHours: string;
  quietFrom: string;
  quietTo: string;
  quietHint: string;
  emailTitle: string;
  emailUpdates: string;
  emailHint: string;
  saving: string;
  saved: string;
  saveFailed: string;
  /** "5:00 pm" or "下午5:00", for an hour of the day (0 to 23). */
  hour: (hour: number) => string;
}

const twelveHour = (hour: number): number => (hour % 12 === 0 ? 12 : hour % 12);

export const NOTIFICATION_PREFERENCES_COPY: PortalCopy<NotificationPreferencesCopy> = {
  en: {
    title: 'Updates and notifications',
    loading: 'Loading your notification settings…',
    loadFailed: 'We could not load your notification settings.',
    tryAgain: 'Try again',
    language: 'Language of your updates and emails',
    languageNames: { en: 'English', zh: 'Chinese' },
    languageHint: 'The daily update, the stay report and our emails use this language.',
    digestHour: 'Daily update arrives at',
    digestHint: 'One update for each pet staying with us, at this time each day.',
    quietHours: 'Quiet hours',
    quietFrom: 'From',
    quietTo: 'To',
    quietHint: 'Only safety notices are sent in this window.',
    emailTitle: 'Email',
    emailUpdates: 'Also email me the updates',
    emailHint: 'They are always in your notifications here too.',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'We could not save that change.',
    hour: (hour) => `${twelveHour(hour)}:00 ${hour < 12 ? 'am' : 'pm'}`,
  },
  zh: {
    title: '动态与通知',
    loading: '正在加载通知设置…',
    loadFailed: '通知设置没有加载出来。',
    tryAgain: '重试',
    language: '动态和邮件的语言',
    languageNames: { en: '英文', zh: '中文' },
    languageHint: '每日动态、住宿报告和我们的邮件都用这个语言。',
    digestHour: '每日动态送达时间',
    digestHint: '住宿期间每只宠物每天一条动态，在这个时间发送。',
    quietHours: '安静时段',
    quietFrom: '从',
    quietTo: '到',
    quietHint: '这段时间只发送安全相关的通知。',
    emailTitle: '邮件',
    emailUpdates: '动态同时发到邮箱',
    emailHint: '这里的通知中也始终可以看到。',
    saving: '正在保存…',
    saved: '已保存',
    saveFailed: '这个更改没有保存成功。',
    hour: (hour) => `${hour < 12 ? '上午' : '下午'}${twelveHour(hour)}:00`,
  },
};

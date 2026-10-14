import type { PortalCopy } from '../../i18n/portalLocale';
import { formatDateTime } from '../stays/formatStayDate';
import type { ParentNotificationsError } from './useParentNotifications';

/**
 * The bell's own words. A notice's title and body come from the server in English; Chinese words
 * them from what they say (see noticeWords.ts).
 */
export interface NotificationsCopy {
  title: string;
  loading: string;
  tryAgain: string;
  empty: string;
  /** Read out before an unread notice's title, where sight has the dot and the bold weight. */
  newPrefix: string;
  errors: Record<ParentNotificationsError, string>;
  /** When a notice was sent. */
  sentAt: (iso: string) => string;
}

const ZH_DATE_TIME = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const NOTIFICATIONS_COPY: PortalCopy<NotificationsCopy> = {
  en: {
    title: 'Notifications',
    loading: 'Loading notifications…',
    tryAgain: 'Try again',
    empty: 'No notifications yet. When our manager decides on a request, you will see it here.',
    newPrefix: 'New: ',
    errors: {
      load: 'We could not load your notifications.',
      read: 'We could not mark your notifications as read.',
    },
    sentAt: formatDateTime,
  },
  zh: {
    title: '通知',
    loading: '正在加载通知…',
    tryAgain: '重试',
    empty: '还没有通知。经理处理你的申请后，结果会显示在这里。',
    newPrefix: '新通知：',
    errors: {
      load: '无法加载你的通知。',
      read: '无法把你的通知标记为已读。',
    },
    sentAt: (iso) => ZH_DATE_TIME.format(new Date(iso)),
  },
};

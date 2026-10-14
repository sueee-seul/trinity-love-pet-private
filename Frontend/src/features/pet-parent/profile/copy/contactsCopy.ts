import type { PortalCopy } from '../../i18n/portalLocale';

/** The words of the emergency contacts card: who we call when the parent cannot be reached. */
export interface ContactsCopy {
  title: string;
  loading: string;
  loadFailed: string;
  tryAgain: string;
  empty: string;
  /** Why we hold the person's details (Privacy Act 2020 IPP 3A). */
  privacy: string;
  name: string;
  phone: string;
  relationship: string;
  /** The box the parent ticks once they have told the person we hold their details. */
  informed: string;
  add: string;
  remove: string;
  phoneRequired: string;
  /** A write the server refused, when its own words cannot be shown. */
  saveFailed: string;
}

export const CONTACTS_COPY: PortalCopy<ContactsCopy> = {
  en: {
    title: 'Emergency contacts',
    loading: 'Loading your contacts…',
    loadFailed: 'We could not load your contacts.',
    tryAgain: 'Try again',
    empty: 'No emergency contact yet.',
    privacy:
      'We keep this only to reach them if we cannot reach you, and we never contact them for marketing.',
    name: 'Name',
    phone: 'Phone',
    relationship: 'Relationship',
    informed: 'I have told this person that Wagstay holds their name and number',
    add: 'Add',
    remove: 'Remove',
    phoneRequired: 'An emergency contact needs a phone number.',
    saveFailed: 'We could not save that change.',
  },
  zh: {
    title: '紧急联系人',
    loading: '正在加载联系人…',
    loadFailed: '联系人没有加载出来。',
    tryAgain: '重试',
    empty: '还没有紧急联系人。',
    privacy: '我们只在联系不上你时用这些信息联系他们，不会用于营销。',
    name: '姓名',
    phone: '电话',
    relationship: '关系',
    informed: '我已经告诉这个人，Wagstay 保存了他们的姓名和电话',
    add: '添加',
    remove: '移除',
    phoneRequired: '紧急联系人需要填写电话。',
    saveFailed: '这个更改没有保存成功。',
  },
};

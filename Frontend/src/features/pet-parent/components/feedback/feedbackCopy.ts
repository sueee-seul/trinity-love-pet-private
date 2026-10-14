import { CONCIERGE_COPY } from '../../../concierge';
import type { DictationButtonLabels, DictationMessages } from '../../../../shared/dictation';
import {
  FEEDBACK_TYPE_PROMPTS,
  type FeedbackType,
  type RatingCategory,
} from '../../../../shared/types/feedback';
import type { PortalCopy, PortalLocale } from '../../i18n/portalLocale';

/**
 * Why the feedback form cannot be sent. Kept as a reason rather than a sentence, so a message on
 * screen follows the reader when they switch language.
 */
export type FeedbackFormError =
  | { kind: 'noPet' }
  | { kind: 'missingCategory' }
  | { kind: 'incomplete' }
  | { kind: 'missingRating'; category: RatingCategory }
  | { kind: 'missingAnswer' }
  | { kind: 'submitFailed' }
  /** The request's own message: shown as it came back in English, worded by the page in Chinese. */
  | { kind: 'server'; message: string };

export interface FeedbackCopy {
  pageTitle: string;
  pageLead: string;
  petPicker: string;
  ratingTitle: string;
  ratingHint: string;
  /** The name of each rated area. The category itself stays the stored key. */
  ratingLabels: Record<RatingCategory, string>;
  starLabel: (star: number) => string;
  typeQuestion: string;
  typeLabels: Record<FeedbackType, string>;
  typePrompts: Record<FeedbackType, string>;
  defaultPrompt: string;
  answerPlaceholder: string;
  submit: string;
  submitting: string;
  sent: string;
  noPet: string;
  missingCategory: string;
  incomplete: string;
  missingRating: (areaLabel: string) => string;
  missingAnswer: string;
  submitFailed: string;
  /** Left out in English, where the voice button and its errors use their own English words. */
  dictationLabels?: DictationButtonLabels;
  dictationMessages?: Partial<DictationMessages>;
}

// The voice button reads the same here as in the booking assistant.
const ZH_DICTATION = CONCIERGE_COPY.zh.chat;

export const FEEDBACK_COPY: PortalCopy<FeedbackCopy> = {
  en: {
    pageTitle: 'Leave feedback',
    pageLead: "How was your pet's stay? Tell us what went well and what we could do better.",
    petPicker: 'Which pet?',
    ratingTitle: 'Rate the stay',
    ratingHint: 'Choose from 1 to 5 stars for each area.',
    ratingLabels: {
      Professional: 'Professional',
      Service: 'Service',
      Communication: 'Communication',
      Safety: 'Safety',
      Cost: 'Cost',
    },
    starLabel: (star) => `${star} of 5 stars`,
    typeQuestion: 'What would you like to share?',
    typeLabels: { Praise: 'Praise', Issue: 'Issue', Suggestion: 'Suggestion' },
    typePrompts: FEEDBACK_TYPE_PROMPTS,
    defaultPrompt: 'Share what you liked, what concerned you, or how we could improve.',
    answerPlaceholder: 'Type your answer here…',
    submit: 'Submit feedback',
    submitting: 'Submitting…',
    sent: 'Your feedback has been sent to the provider.',
    noPet: 'Add a pet to your profile before leaving feedback.',
    missingCategory: 'Please choose a feedback category.',
    incomplete: 'Form incomplete. Please ensure all ratings and questions are filled.',
    missingRating: (areaLabel) => `Please provide a star rating for "${areaLabel}".`,
    missingAnswer: 'Please answer the feedback question.',
    submitFailed: 'An error occurred while analyzing your feedback. Please try again.',
  },
  zh: {
    pageTitle: '留下反馈',
    pageLead: '毛孩子这次住得怎么样？告诉我们哪些地方做得好，哪些地方还可以改进。',
    petPicker: '哪只宠物？',
    ratingTitle: '为这次住宿打分',
    ratingHint: '每一项选 1 到 5 颗星。',
    ratingLabels: {
      Professional: '专业程度',
      Service: '服务',
      Communication: '沟通',
      Safety: '安全',
      Cost: '费用',
    },
    starLabel: (star) => `${star} 颗星，满分 5 颗星`,
    typeQuestion: '你想分享哪方面？',
    typeLabels: { Praise: '表扬', Issue: '问题', Suggestion: '建议' },
    typePrompts: {
      Praise: '这次住宿中，你最满意的是什么？',
      Issue: '在照顾宠物方面，有什么让你担心的地方？',
      Suggestion: '我们怎样做能让你的体验更好？',
    },
    defaultPrompt: '说说你满意的地方、担心的地方，或者我们可以改进的地方。',
    answerPlaceholder: '在这里输入你的回答…',
    submit: '提交反馈',
    submitting: '提交中…',
    sent: '你的反馈已经发送给寄养服务方。',
    noPet: '请先在个人资料里添加宠物，再留下反馈。',
    missingCategory: '请选择反馈类型。',
    incomplete: '表单还没填完，请完成所有评分和问题。',
    missingRating: (areaLabel) => `请为“${areaLabel}”打分。`,
    missingAnswer: '请回答反馈问题。',
    submitFailed: '分析你的反馈时出错了，请再试一次。',
    dictationLabels: ZH_DICTATION.dictation,
    dictationMessages: {
      ...ZH_DICTATION.dictationErrors,
      // The speech service writes its own errors in English.
      streamFailed: ZH_DICTATION.dictationErrors.failed,
    },
  },
};

/** The sentence for a form error, in the reader's language. */
export function feedbackErrorText(
  error: FeedbackFormError,
  copy: FeedbackCopy,
  locale: PortalLocale,
): string {
  switch (error.kind) {
    case 'missingRating':
      return copy.missingRating(copy.ratingLabels[error.category]);
    case 'server':
      return locale === 'en' ? error.message : copy.submitFailed;
    default:
      return copy[error.kind];
  }
}

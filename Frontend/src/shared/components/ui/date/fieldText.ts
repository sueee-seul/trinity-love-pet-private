import type { FieldLocale } from './dateValue';

/** The fixed words the date and time fields show, in each supported language. */
export interface FieldText {
  datePlaceholder: string;
  timePlaceholder: string;
  timeLabel: string;
  close: string;
  clear: string;
}

export const FIELD_TEXT: Record<FieldLocale, FieldText> = {
  en: {
    datePlaceholder: 'Choose a date',
    timePlaceholder: 'Choose a time',
    timeLabel: 'Time',
    close: 'Close',
    clear: 'Clear',
  },
  zh: {
    datePlaceholder: '选择日期',
    timePlaceholder: '选择时间',
    timeLabel: '时间',
    close: '关闭',
    clear: '清除',
  },
};

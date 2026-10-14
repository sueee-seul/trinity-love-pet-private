import type { ConciergeLocale } from './types';

/** The words of the "say it once" box on the details step. */
export interface DetailsFillCopy {
  title: string;
  lead: string;
  label: string;
  placeholder: string;
  read: string;
  reading: string;
  foundTitle: string;
  nothingFound: string;
  use: string;
  discard: string;
  failed: string;
  fieldNames: Record<string, string>;
  pet: (index: number) => string;
}

export const DETAILS_FILL_COPY: Record<ConciergeLocale, DetailsFillCopy> = {
  en: {
    title: 'Say it once, we fill it in',
    lead: 'Speak or type who you are and about your pet. Check what we understood, then use it. Your email and password you type yourself.',
    label: 'About you and your pet',
    placeholder:
      'For example: I’m Nina Park, mobile 021 555 0142. Biscuit is a golden retriever, eats two cups of kibble twice a day.',
    read: 'Fill the form',
    reading: 'Reading…',
    foundTitle: 'We understood',
    nothingFound: 'We could not find any details in that. Try again, or fill in the form.',
    use: 'Use these details',
    discard: 'Not right',
    failed: 'We could not read that just now. Please fill in the form.',
    fieldNames: {
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Mobile',
      address: 'Home address',
      emergencyContactNumber: 'Emergency contact',
      careNotes: 'For our team',
    },
    pet: (index) => `Pet ${index + 1}`,
  },
  zh: {
    title: '说一遍，我们帮你填',
    lead: '说出或写下你的信息和宠物的情况，确认我们理解得对，再一键填入。邮箱和密码请自己输入。',
    label: '你和宠物的情况',
    placeholder:
      '比如：我叫 Nina Park，手机 021 555 0142。Biscuit 是金毛，每天两顿，每顿两杯狗粮。',
    read: '帮我填表',
    reading: '正在读取…',
    foundTitle: '我们理解到的',
    nothingFound: '没有从中找到资料。请再试一次，或者自己填写。',
    use: '用这些信息',
    discard: '不对',
    failed: '暂时读不了，请自己填写表单。',
    fieldNames: {
      firstName: '名',
      lastName: '姓',
      phone: '手机',
      address: '家庭住址',
      emergencyContactNumber: '紧急联系人',
      careNotes: '给员工的备注',
    },
    pet: (index) => `宠物 ${index + 1}`,
  },
};

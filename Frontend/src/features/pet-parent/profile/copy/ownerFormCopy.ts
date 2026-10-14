import type { PortalCopy } from '../../i18n/portalLocale';
import { PHONE_FORMAT_MESSAGE } from '../../../../shared/utils/phone';
import type { PhoneErrorCopy } from '../phoneProblem';

/** The words of the owner's Edit profile form. */
export interface OwnerFormCopy {
  profilePhoto: string;
  noPhoto: string;
  fullName: string;
  email: string;
  emailLocked: string;
  phone: string;
  phoneErrors: PhoneErrorCopy;
  dateOfBirth: string;
  address: string;
  cancel: string;
  save: string;
}

export const OWNER_FORM_COPY: PortalCopy<OwnerFormCopy> = {
  en: {
    profilePhoto: 'Profile photo',
    noPhoto: 'No photo',
    fullName: 'Full name',
    email: 'Email',
    emailLocked: 'Email is your sign-in and cannot be changed here',
    phone: 'Phone',
    // The same sentences shared/utils/phone.ts writes for a required phone number.
    phoneErrors: { required: 'A phone number is required.', format: PHONE_FORMAT_MESSAGE },
    dateOfBirth: 'Date of birth',
    address: 'Address (optional)',
    cancel: 'Cancel',
    save: 'Save changes',
  },
  zh: {
    profilePhoto: '头像',
    noPhoto: '没有照片',
    fullName: '姓名',
    email: '邮箱',
    emailLocked: '邮箱是你的登录账号，不能在这里修改',
    phone: '电话',
    phoneErrors: {
      required: '请填写电话号码。',
      format: '请填写有效的电话号码，比如 +64 21 123 4567 或 021 123 4567',
    },
    dateOfBirth: '出生日期',
    address: '地址（选填）',
    cancel: '取消',
    save: '保存修改',
  },
};

/**
 * The emergency contact number field of the owner form. Privacy Act 2020 IPP 3A asks us to make
 * sure the person behind the number knows we hold it, so its notice travels with the field.
 */
export interface EmergencyNumberCopy {
  label: string;
  notice: string;
  /** Only the format can be wrong: the field may be left empty. */
  formatError: string;
}

export const EMERGENCY_NUMBER_COPY: PortalCopy<EmergencyNumberCopy> = {
  en: {
    label: 'Emergency contact number (optional)',
    notice:
      'This is optional. Please tell this person Wagstay keeps their number to contact them in an emergency with your pet. They can ask our team to access or correct their details.',
    formatError: PHONE_FORMAT_MESSAGE,
  },
  zh: {
    label: '紧急联系人电话（选填）',
    notice:
      '可以留空。若填写，请告知对方 Wagstay 会保存此号码，仅在宠物遇到紧急情况时联系；对方可联系我们查看或更正资料。',
    formatError: '请填写有效的电话号码，比如 +64 21 123 4567 或 021 123 4567',
  },
};

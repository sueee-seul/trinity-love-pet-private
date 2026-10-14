import type { SiteCopy } from '../i18n/siteLanguage';
import type { SignupField, SignupFieldError } from './components/signupTypes';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type PasswordRuleId } from './passwordRules';

/** A sign-in notice handed to the sign-in page by the page that sent the visitor there. */
export type AuthNoticeKind = 'accountCreated' | 'passwordReset';

export interface AuthCopy {
  layout: { footer: string };
  /**
   * The server's sentence in the reader's language. The server writes English, so English shows
   * it as sent and Chinese uses the Chinese below, or the page's own sentence (`fallback`).
   */
  fromServer: (message: string | undefined, fallback: string) => string;
  /** A field the server refused, by the rule it broke (`error.code`). */
  fieldError: (field: SignupField, error: SignupFieldError) => string;
  notices: Record<AuthNoticeKind, string>;
  login: {
    backHome: string;
    signIn: string;
    welcome: string;
    useAccount: string;
    email: string;
    or: string;
    googleNotSetUp: string;
    loadingGoogle: string;
    /** Google's own code for the language its button is drawn in. */
    googleLocale: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    bookPrompt: string;
    bookLink: string;
    createAccount: string;
    next: string;
    enterEmail: string;
    invalidEmail: string;
    accountNotFound: string;
    wrongPassword: string;
    connectionFailed: string;
    loginFailed: string;
    googleFailed: string;
    googleAuthFailed: string;
  };
  signup: {
    footer: string;
    titleAccount: string;
    titleProfile: string;
    subtitleGoogle: string;
    subtitleAccount: string;
    subtitleProfile: string;
    labels: Record<SignupField, string>;
    showField: (label: string) => string;
    hideField: (label: string) => string;
    back: string;
    backToSignIn: string;
    checking: string;
    next: string;
    createAccount: string;
    fixFields: string;
    validateUnavailable: string;
    createUnavailable: string;
    createFailed: string;
    processUnavailable: string;
  };
  passwordRules: {
    heading: string;
    rules: Record<PasswordRuleId, string>;
    match: string;
    done: string;
    notYet: string;
  };
  forgot: {
    title: string;
    subtitle: string;
    footer: string;
    email: string;
    sending: string;
    sendLink: string;
    sent: string;
    continueReset: string;
    backToSignIn: string;
    invalidEmail: string;
    resetUnavailable: string;
  };
  setPassword: {
    title: string;
    invalidLink: string;
    requestNew: string;
    subtitleReset: string;
    subtitleTemporary: string;
    footerReset: string;
    footerTemporary: string;
    newPassword: string;
    confirmNew: string;
    saving: string;
    resetPassword: string;
    setAndContinue: string;
    backToSignIn: string;
    notAllRules: string;
    mismatch: string;
    updateFailed: string;
    unreachable: string;
  };
}

/** The server's fixed sentences on these pages, in Chinese. */
const SERVER_WORDS_IN_CHINESE: Readonly<Record<string, string>> = {
  'Email not registered.': '找不到这个邮箱对应的 Wagstay 账户。',
  'Email is required': '请输入邮箱。',
  'Email and password are required': '请输入邮箱和密码。',
  'Enter a valid email address.': '请输入有效的邮箱地址。',
  'Wrong password. Try again.': '密码不对，请再试一次。',
  'User not registered': '这个 Google 账户还没有注册 Wagstay。',
  'Google has not verified this email address': 'Google 还没有验证这个邮箱地址。',
  'Google sign-in is not configured': '还没有设置 Google 登录。',
  'Invalid Google token payload': 'Google 登录没有成功，请重试。',
  'Invalid Google user': 'Google 登录没有成功，请重试。',
  'Password validation failed': '密码不符合要求。',
  'Temporary password change is not available': '这个设置密码的入口已经不能用了。',
  'Temporary password change is no longer available': '这个设置密码的入口已经不能用了。',
  'Unable to update password': '密码没有更新成功，请重试。',
  'Unable to prepare password reset': '暂时无法准备重置密码，请重试。',
  'Signup validation failed': '请修改标出的内容。',
  'Signup validation failed due to conflict': '这个邮箱或用户名已经被使用了。',
  'This email is already registered.': '这个邮箱已经注册过了。',
  'This username is already registered.': '这个用户名已经被使用了。',
};

/** The rate limit names its wait in English ("Try again in 30 seconds."). */
const RATE_LIMITED_PREFIX = 'Too many requests';

/** The server's field rules by code; `VALIDATION_ERROR` is worded by field instead. */
const FIELD_RULES_IN_CHINESE: Readonly<Record<string, string>> = {
  INVALID_EMAIL: '请输入有效的邮箱地址。',
  EMAIL_ALREADY_REGISTERED: '这个邮箱已经注册过了。',
  USERNAME_ALREADY_REGISTERED: '这个用户名已经被使用了。',
  PASSWORD_REQUIRED: '请设置密码。',
  PASSWORD_INVALID_LENGTH: `密码需要 ${PASSWORD_MIN_LENGTH} 到 ${PASSWORD_MAX_LENGTH} 个字符。`,
  PASSWORD_MISSING_NUMBER: '密码至少需要一个数字。',
  PASSWORD_MISSING_SYMBOL: '密码至少需要一个符号。',
  PASSWORD_SURROUNDING_WHITESPACE: '密码开头和结尾不能有空格。',
  PASSWORD_PERSONAL_INFORMATION: '密码不能包含你的个人信息。',
  CONFIRM_PASSWORD_REQUIRED: '请再次输入密码。',
  PASSWORD_MISMATCH: '两次输入的密码不一致。',
};

const FIELDS_IN_CHINESE: Record<SignupField, string> = {
  email: '请输入有效的邮箱地址。',
  username: '请设置一个用户名。',
  password: '请检查密码。',
  confirmPassword: '请再次输入密码。',
  emergencyContactNumber: '请输入有效的电话号码，例如 021 123 4567。',
  firstName: '请输入你的名字。',
  lastName: '请输入你的姓氏。',
  address: '请检查地址。',
  dateOfBirth: '请输入有效的出生日期，不能晚于今天。',
};

const EN: AuthCopy = {
  layout: { footer: 'Pet Parent & Admin Portal' },
  fromServer: (message, fallback) => message || fallback,
  fieldError: (_field, error) => error.message,
  notices: {
    accountCreated: 'Account created successfully. You can now sign in.',
    passwordReset: 'Password reset successfully. You can now sign in.',
  },
  login: {
    backHome: 'Back to home',
    signIn: 'Sign in',
    welcome: 'Welcome',
    useAccount: 'Use your Wagstay account',
    email: 'Email',
    or: 'or',
    googleNotSetUp: 'Google sign-in is not set up yet',
    loadingGoogle: 'Loading Google...',
    googleLocale: 'en',
    password: 'Enter your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgotPassword: 'Forgot password?',
    bookPrompt: 'Just want to book a stay?',
    bookLink: 'Plan it with our booking assistant. No account needed.',
    createAccount: 'Create account',
    next: 'Next',
    enterEmail: 'Enter an email',
    invalidEmail: 'Please enter a valid email address.',
    accountNotFound: "Couldn't find your Wagstay account",
    wrongPassword: 'Wrong password. Try again.',
    connectionFailed: 'Connection failed. Please try again.',
    loginFailed: 'Login failed. Please try again.',
    googleFailed: 'Google login failed',
    googleAuthFailed: 'Google authentication failed. Please try again.',
  },
  signup: {
    footer: 'Pet Parent Portal',
    titleAccount: 'Create account',
    titleProfile: 'Tell us about you',
    subtitleGoogle: 'Complete your Google Pet Parent profile',
    subtitleAccount: 'Create your Pet Parent account · Step 1 of 2',
    subtitleProfile: 'Complete your Pet Parent profile · Step 2 of 2',
    labels: {
      email: 'Email',
      username: 'Username',
      password: 'Choose your password',
      confirmPassword: 'Re-enter your password',
      emergencyContactNumber: 'Emergency contact number (optional)',
      firstName: 'First name',
      lastName: 'Last name',
      address: 'Address (optional)',
      dateOfBirth: 'Date of birth (optional)',
    },
    showField: (label) => `Show ${label.toLowerCase()}`,
    hideField: (label) => `Hide ${label.toLowerCase()}`,
    back: 'Back',
    backToSignIn: 'Back to sign in',
    checking: 'Checking...',
    next: 'Next',
    createAccount: 'Create account',
    fixFields: 'Please fix the highlighted fields.',
    validateUnavailable: 'Unable to validate signup right now. Please try again.',
    createUnavailable: 'Unable to create your account right now. Please try again.',
    createFailed: 'Unable to create your account.',
    processUnavailable: 'Unable to process request right now. Please try again.',
  },
  passwordRules: {
    heading: 'Your password needs:',
    rules: {
      length: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      number: 'At least one number',
      symbol: 'At least one symbol, such as ! @ # or ?',
      edges: 'No space at the start or end',
    },
    match: 'Both passwords match',
    done: ' (done)',
    notYet: ' (not yet)',
  },
  forgot: {
    title: 'Forgot password?',
    subtitle: 'Enter your email and we’ll help you get back into your account.',
    footer: 'Password recovery',
    email: 'Email',
    sending: 'Sending…',
    sendLink: 'Send reset link',
    sent: 'If the account exists, a reset link has been prepared. Check your email.',
    continueReset: 'Continue to reset password',
    backToSignIn: 'Back to sign in',
    invalidEmail: 'Please enter a valid email address.',
    resetUnavailable: 'Unable to prepare password reset. Please try again.',
  },
  setPassword: {
    title: 'Set your password',
    invalidLink: 'This password reset link is invalid or has expired.',
    requestNew: 'Request a new password reset link to continue.',
    subtitleReset: 'Choose a new password before signing in again.',
    subtitleTemporary:
      'Your manager created this account. Choose a personal password before continuing.',
    footerReset: 'Password recovery',
    footerTemporary: 'Staff account activation',
    newPassword: 'New password',
    confirmNew: 'Confirm new password',
    saving: 'Saving…',
    resetPassword: 'Reset password',
    setAndContinue: 'Set password and continue',
    backToSignIn: 'Back to sign in',
    notAllRules: 'Your password does not meet every requirement in the list yet.',
    mismatch: 'The two passwords do not match.',
    updateFailed: 'Unable to update your password. Please try again.',
    unreachable: 'We could not reach the server. Check your connection and try again.',
  },
};

const ZH: AuthCopy = {
  layout: { footer: '宠物家长和员工入口' },
  fromServer: (message, fallback) => {
    if (!message) return fallback;
    if (message.startsWith(RATE_LIMITED_PREFIX)) return '尝试次数太多，请稍后再试。';
    return SERVER_WORDS_IN_CHINESE[message] ?? fallback;
  },
  fieldError: (field, error) => FIELD_RULES_IN_CHINESE[error.code] ?? FIELDS_IN_CHINESE[field],
  notices: {
    accountCreated: '账户创建成功，现在可以登录了。',
    passwordReset: '密码已重置，现在可以登录了。',
  },
  login: {
    backHome: '返回首页',
    signIn: '登录',
    welcome: '欢迎回来',
    useAccount: '使用你的 Wagstay 账户',
    email: '邮箱',
    or: '或',
    googleNotSetUp: '还没有设置 Google 登录',
    loadingGoogle: '正在加载 Google…',
    googleLocale: 'zh_CN',
    password: '输入密码',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    forgotPassword: '忘记密码？',
    bookPrompt: '只是想预约住宿？',
    bookLink: '用预约助手来安排，不需要注册账户。',
    createAccount: '创建账户',
    next: '下一步',
    enterEmail: '请输入邮箱。',
    invalidEmail: '请输入有效的邮箱地址。',
    accountNotFound: '找不到你的 Wagstay 账户。',
    wrongPassword: '密码不对，请再试一次。',
    connectionFailed: '连接失败，请重试。',
    loginFailed: '登录没有成功，请重试。',
    googleFailed: 'Google 登录没有成功。',
    googleAuthFailed: 'Google 验证没有成功，请重试。',
  },
  signup: {
    footer: '宠物家长中心',
    titleAccount: '创建账户',
    titleProfile: '介绍一下你自己',
    subtitleGoogle: '完善你的 Google 宠物家长资料',
    subtitleAccount: '创建你的宠物家长账户 · 第 1 步，共 2 步',
    subtitleProfile: '完善你的宠物家长资料 · 第 2 步，共 2 步',
    labels: {
      email: '邮箱',
      username: '用户名',
      password: '设置密码',
      confirmPassword: '再次输入密码',
      emergencyContactNumber: '紧急联系电话（选填）',
      firstName: '名字',
      lastName: '姓氏',
      address: '地址（选填）',
      dateOfBirth: '出生日期（选填）',
    },
    showField: (label) => `显示${label}`,
    hideField: (label) => `隐藏${label}`,
    back: '返回',
    backToSignIn: '返回登录',
    checking: '检查中…',
    next: '下一步',
    createAccount: '创建账户',
    fixFields: '请修改标出的内容。',
    validateUnavailable: '暂时无法检查注册信息，请重试。',
    createUnavailable: '暂时无法创建账户，请重试。',
    createFailed: '账户没有创建成功。',
    processUnavailable: '暂时无法处理请求，请重试。',
  },
  passwordRules: {
    heading: '你的密码需要：',
    rules: {
      length: `${PASSWORD_MIN_LENGTH} 到 ${PASSWORD_MAX_LENGTH} 个字符`,
      number: '至少一个数字',
      symbol: '至少一个符号，例如 ! @ # 或 ?',
      edges: '开头和结尾不能有空格',
    },
    match: '两次输入的密码一致',
    done: '（已完成）',
    notYet: '（未完成）',
  },
  forgot: {
    title: '忘记密码？',
    subtitle: '输入你的邮箱，我们会帮你找回账户。',
    footer: '找回密码',
    email: '邮箱',
    sending: '发送中…',
    sendLink: '发送重置链接',
    sent: '如果这个账户存在，我们已经准备好重置链接，请查看你的邮箱。',
    continueReset: '继续重置密码',
    backToSignIn: '返回登录',
    invalidEmail: '请输入有效的邮箱地址。',
    resetUnavailable: '暂时无法准备重置密码，请重试。',
  },
  setPassword: {
    title: '设置密码',
    invalidLink: '这个重置链接无效或已过期。',
    requestNew: '请重新申请一个重置链接。',
    subtitleReset: '请先设置新密码，再重新登录。',
    subtitleTemporary: '这个账户是经理为你创建的。继续之前，请设置你自己的密码。',
    footerReset: '找回密码',
    footerTemporary: '员工账户激活',
    newPassword: '新密码',
    confirmNew: '确认新密码',
    saving: '保存中…',
    resetPassword: '重置密码',
    setAndContinue: '设置密码并继续',
    backToSignIn: '返回登录',
    notAllRules: '你的密码还没有满足列表里的所有要求。',
    mismatch: '两次输入的密码不一致。',
    updateFailed: '密码没有更新成功，请重试。',
    unreachable: '连接不上服务器，请检查网络后重试。',
  },
};

/** Every word the sign-in, sign-up and password pages show, in both languages. */
export const AUTH_COPY: SiteCopy<AuthCopy> = { en: EN, zh: ZH };

/**
 * Words decided by what happened, worded when shown, so an error raised before a language switch
 * is reworded after it.
 */
export type AuthText = (copy: AuthCopy) => string;

/** A field's server errors in the reader's language, in the shape the fields render. */
export const localizeFieldErrors = (
  field: SignupField,
  errors: SignupFieldError[] | undefined,
  copy: AuthCopy,
): SignupFieldError[] | undefined =>
  errors?.map((error) => ({ ...error, message: copy.fieldError(field, error) }));

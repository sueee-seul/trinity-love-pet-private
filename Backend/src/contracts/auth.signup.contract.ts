import { z } from 'zod';
import { PHONE_FORMAT_MESSAGE, isValidPhoneNumber } from '../common/utils/phone.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

export type SignupValidationField =
  | 'email'
  | 'username'
  | 'password'
  | 'confirmPassword'
  | 'emergencyContactNumber'
  | 'firstName'
  | 'lastName'
  | 'address'
  | 'dateOfBirth';

export interface SignupFieldError {
  code: string;
  message: string;
}

export type SignupFieldErrors = Partial<Record<SignupValidationField, SignupFieldError[]>>;

export interface SignupValidationResult {
  success: boolean;
  fieldErrors: SignupFieldErrors;
}

const requiredString = (message: string): z.ZodString => {
  return z.string({ error: message });
};

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const dateParts = value.split('-');
  const year = Number(dateParts[0] ?? '');
  const month = Number(dateParts[1] ?? '');
  const day = Number(dateParts[2] ?? '');
  if (![year, month, day].every((part) => Number.isInteger(part))) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const isFutureDate = (value: string): boolean => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayValue = `${today.getFullYear()}-${month}-${day}`;
  return value > todayValue;
};

const normalizePersonalValue = (value: string): string => {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
};

const containsPersonalInformation = (
  password: string,
  personalValues: readonly string[],
): boolean => {
  const normalizedPassword = normalizePersonalValue(password);

  return personalValues.some((value) => {
    const normalizedValue = normalizePersonalValue(value);
    return normalizedValue.length >= 3 && normalizedPassword.includes(normalizedValue);
  });
};

const addIssue = (
  context: z.RefinementCtx,
  path: SignupValidationField,
  code: string,
  message: string,
): void => {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
    params: { validationCode: code },
  });
};

export interface PasswordInput {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
}

const getPersonalInformationValues = (data: PasswordInput): string[] => {
  const emailLocalPart = data.email.split('@')[0] ?? '';
  const dateDigits = data.dateOfBirth?.replace(/\D/g, '') ?? '';
  const dateYear = data.dateOfBirth?.slice(0, 4) ?? '';

  return [
    emailLocalPart,
    data.username,
    data.firstName ?? '',
    data.lastName ?? '',
    dateDigits,
    dateYear,
  ].filter((value) => value.length >= 3);
};

export interface PasswordIssue {
  code: string;
  message: string;
}

/**
 * What is wrong with a new password, in the order the sign-up form shows it; empty when it is
 * fine. Sign-up and the account a guest makes at checkout use this one rule.
 */
export const newPasswordIssues = (data: PasswordInput): PasswordIssue[] => {
  if (!data.password) return [{ code: 'PASSWORD_REQUIRED', message: 'Choose a password.' }];
  const issues: PasswordIssue[] = [];
  if (data.password.length < PASSWORD_MIN_LENGTH || data.password.length > PASSWORD_MAX_LENGTH) {
    issues.push({
      code: 'PASSWORD_INVALID_LENGTH',
      message: 'Password must be between 8 and 32 characters.',
    });
  }
  if (!/\d/.test(data.password)) {
    issues.push({
      code: 'PASSWORD_MISSING_NUMBER',
      message: 'Password must contain at least one number.',
    });
  }
  if (!/[^A-Za-z0-9\s]/.test(data.password)) {
    issues.push({
      code: 'PASSWORD_MISSING_SYMBOL',
      message: 'Password must contain at least one symbol.',
    });
  }
  if (data.password !== data.password.trim()) {
    issues.push({
      code: 'PASSWORD_SURROUNDING_WHITESPACE',
      message: 'Password cannot start or end with whitespace.',
    });
  }
  if (containsPersonalInformation(data.password, getPersonalInformationValues(data))) {
    issues.push({
      code: 'PASSWORD_PERSONAL_INFORMATION',
      message: 'Password should not include your personal information.',
    });
  }
  return issues;
};

const addPasswordIssues = (data: PasswordInput, context: z.RefinementCtx): void => {
  for (const issue of newPasswordIssues(data)) {
    addIssue(context, 'password', issue.code, issue.message);
  }

  if (!data.confirmPassword) {
    addIssue(context, 'confirmPassword', 'CONFIRM_PASSWORD_REQUIRED', 'Re-enter your password.');
  } else if (data.password !== data.confirmPassword) {
    addIssue(context, 'confirmPassword', 'PASSWORD_MISMATCH', 'Passwords do not match.');
  }
};

const accountFields = {
  email: requiredString('Enter an email.').trim().email('Enter a valid email address.'),
  username: requiredString('Choose a username.').trim().min(1, 'Choose a username.'),
  password: requiredString('Choose a password.'),
  confirmPassword: requiredString('Re-enter your password.'),
};

const accountSchema = z
  .object({
    step: z.literal('account'),
    ...accountFields,
  })
  .superRefine((data, context) => addPasswordIssues(data, context));

/**
 * A field a parent may leave blank: blank or missing is `null`, so nothing is stored. Sign-up
 * collects only what a booking needs (Privacy Act 2020, IPP 1); the booking page asks for the
 * same three as optional, and the parent can add them to the profile later.
 */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

const profileFields = {
  emergencyContactNumber: optionalText.refine(
    (value) => value === null || isValidPhoneNumber(value),
    PHONE_FORMAT_MESSAGE,
  ),
  firstName: requiredString('Enter your first name.').trim().min(1, 'Enter your first name.'),
  lastName: requiredString('Enter your last name.').trim().min(1, 'Enter your last name.'),
  address: optionalText,
  dateOfBirth: optionalText
    .refine((value) => value === null || isValidDate(value), 'Enter a valid date of birth.')
    .refine(
      (value) => value === null || !isFutureDate(value),
      'Date of birth cannot be in the future.',
    ),
};

export const signupProfileSchema = z
  .object({
    step: z.literal('profile'),
    ...accountFields,
    ...profileFields,
  })
  .superRefine((data, context) => addPasswordIssues(data, context));

export const temporaryPasswordChangeSchema = z
  .object({
    password: requiredString('Choose a new password.'),
    confirmPassword: requiredString('Re-enter your new password.'),
  })
  .superRefine((data, context) =>
    addPasswordIssues(
      {
        email: '',
        username: '',
        password: data.password,
        confirmPassword: data.confirmPassword,
      },
      context,
    ),
  );

export type TemporaryPasswordChangeRequest = z.infer<typeof temporaryPasswordChangeSchema>;

export const googleSignupProfileSchema = z.object(profileFields);

export type SignupProfileRequest = z.infer<typeof signupProfileSchema>;

export const signupValidationRequestSchema = z.union([accountSchema, signupProfileSchema]);

const isSignupValidationField = (value: unknown): value is SignupValidationField => {
  return (
    value === 'email' ||
    value === 'username' ||
    value === 'password' ||
    value === 'confirmPassword' ||
    value === 'emergencyContactNumber' ||
    value === 'firstName' ||
    value === 'lastName' ||
    value === 'address' ||
    value === 'dateOfBirth'
  );
};

const getIssueCode = (issue: z.ZodIssue): string => {
  if (issue.code === z.ZodIssueCode.custom && issue.params) {
    const validationCode = issue.params.validationCode;
    if (typeof validationCode === 'string') {
      return validationCode;
    }
  }

  if (
    issue.code === z.ZodIssueCode.invalid_format &&
    'format' in issue &&
    issue.format === 'email'
  ) {
    return 'INVALID_EMAIL';
  }

  return 'VALIDATION_ERROR';
};

export const toSignupFieldErrors = (error: z.ZodError): SignupFieldErrors => {
  const fieldErrors: SignupFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (!isSignupValidationField(field)) {
      continue;
    }

    const currentErrors = fieldErrors[field] ?? [];
    const nextError = { code: getIssueCode(issue), message: issue.message };
    if (!currentErrors.some((item) => item.code === nextError.code)) {
      fieldErrors[field] = [...currentErrors, nextError];
    }
  }

  return fieldErrors;
};

export const validateSignupRequest = (payload: unknown): SignupValidationResult => {
  const result = signupValidationRequestSchema.safeParse(payload);
  if (!result.success) {
    return { success: false, fieldErrors: toSignupFieldErrors(result.error) };
  }

  return { success: true, fieldErrors: {} };
};

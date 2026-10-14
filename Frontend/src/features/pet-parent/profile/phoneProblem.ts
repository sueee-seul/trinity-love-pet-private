import { optionalPhoneError, phoneError } from '../../../shared/utils/phone';

/**
 * The profile forms' phone messages in the reader's language.
 *
 * shared/utils/phone.ts holds the rule, kept identical to the backend's, and writes its reasons in
 * English for every form that uses it. These helpers let that rule decide whether a number is
 * wrong and only choose the words, so the rule itself is never copied.
 */
export interface PhoneErrorCopy {
  required: string;
  format: string;
}

/** Why a required number cannot be saved, or `null` when it is fine. */
export function requiredPhoneProblem(value: string, errors: PhoneErrorCopy): string | null {
  if (phoneError(value) === null) return null;
  return value.trim().length === 0 ? errors.required : errors.format;
}

/** Why a number that may be left empty cannot be saved, or `null` when it is fine. */
export function optionalPhoneProblem(value: string, formatError: string): string | null {
  return optionalPhoneError(value) === null ? null : formatError;
}

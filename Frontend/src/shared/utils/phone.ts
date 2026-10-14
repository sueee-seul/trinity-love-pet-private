/**
 * The same phone rule the backend enforces, so a screen never lets someone
 * submit a number the server is going to reject. Kept deliberately identical
 * to `Backend/src/common/utils/phone.ts` - if one changes, change both.
 *
 *   +64 21 555 0101   international (E.164), 8-15 digits after the `+`
 *   021 555 0101      New Zealand local, 9-11 digits including the leading 0
 */
export const PHONE_FORMAT_MESSAGE =
  'Enter a valid phone number, e.g. +64 21 123 4567 or 021 123 4567';

const strip = (value: string): string => value.replace(/[\s\-().]/g, '');

export const isValidPhoneNumber = (value: string): boolean => {
  const digits = strip(value);
  return /^\+[1-9]\d{7,14}$/.test(digits) || /^0\d{8,10}$/.test(digits);
};

/** The reason this number cannot be saved, or `null` when it is fine. */
export const phoneError = (value: string, label = 'A contact number'): string | null => {
  if (value.trim().length === 0) {
    return `${label} is required.`;
  }
  return isValidPhoneNumber(value) ? null : PHONE_FORMAT_MESSAGE;
};

/** As `phoneError`, for a number that may be left empty (the backend's `optionalPhoneNumber`). */
export const optionalPhoneError = (value: string): string | null =>
  value.trim().length === 0 ? null : phoneError(value);

/**
 * One phone rule for the whole product - signup, the staff profile and the pet
 * parent profile all check a number the same way, so a number accepted in one
 * place is never rejected in another.
 *
 * Two shapes are accepted, because both are in the data and both are how
 * people actually write a number here:
 *
 *   +64 21 555 0101   international (E.164), 8-15 digits after the `+`
 *   021 555 0101      New Zealand local, 9-11 digits including the leading 0
 *
 * Spaces, hyphens, brackets and dots are formatting, so they are stripped
 * before the digits are counted. Everything else is rejected: a number that
 * cannot be dialled is not a contact number.
 */
export const PHONE_FORMAT_MESSAGE =
  'Enter a valid phone number, e.g. +64 21 123 4567 or 021 123 4567';

const strip = (value: string): string => value.replace(/[\s\-().]/g, '');

export const isValidPhoneNumber = (value: string): boolean => {
  const digits = strip(value);
  return /^\+[1-9]\d{7,14}$/.test(digits) || /^0\d{8,10}$/.test(digits);
};

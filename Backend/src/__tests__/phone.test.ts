import { describe, expect, it } from 'vitest';
import { isValidPhoneNumber } from '../common/utils/phone.js';

/**
 * Signup, the staff profile and the pet parent profile all call this, so what
 * it accepts is the product's single answer to "is that a phone number".
 * Every number already stored in the database passes.
 */
describe('phone number rule', () => {
  it.each([
    ['+64 21 555 0101', 'international with spaces'],
    ['+6421555010', 'international, no spaces'],
    ['+64-21-555-0101', 'international with hyphens'],
    ['021 000 1111', 'NZ mobile, local'],
    ['02041844951', 'NZ mobile, 11 digits'],
    ['09 555 0180', 'NZ landline, 9 digits'],
    ['(09) 555-0180', 'NZ landline with brackets'],
  ])('accepts %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  it.each([
    ['', 'blank'],
    ['   ', 'whitespace only'],
    ['abc', 'letters'],
    ['12345', 'digits with no leading 0 or +'],
    ['021', 'far too short'],
    ['0211', 'still too short'],
    ['+12', 'international but too short'],
    ['021000111122', 'too long for a local number'],
    ['+6421555010112345', 'longer than E.164 allows'],
    ['+0211234567', 'country code cannot start with 0'],
  ])('rejects %s (%s)', (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });
});

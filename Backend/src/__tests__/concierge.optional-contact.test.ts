import { describe, expect, it } from 'vitest';
import { conciergeContactSchema } from '../contracts/concierge.contract.js';
const contact = { firstName: 'Ava', lastName: 'Mitchell', phone: '021 555 0199' };
describe('optional contact details', () => {
  it('accepts no home address or emergency number', () =>
    expect(conciergeContactSchema.safeParse(contact).success).toBe(true));
  it('keeps a valid emergency number', () =>
    expect(
      conciergeContactSchema.parse({ ...contact, emergencyContactNumber: '021 555 0123' }),
    ).toHaveProperty('emergencyContactNumber', '021 555 0123'));
  it('rejects an invalid supplied emergency number', () =>
    expect(
      conciergeContactSchema.safeParse({ ...contact, emergencyContactNumber: 'bad number' })
        .success,
    ).toBe(false));
  it('accepts an explicitly blank optional number', () =>
    expect(
      conciergeContactSchema.safeParse({ ...contact, emergencyContactNumber: '' }).success,
    ).toBe(true));
});

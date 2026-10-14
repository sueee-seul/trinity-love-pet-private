import { describe, expect, it } from 'vitest';
import { validateDetails, type DetailsDraft } from '../utils/validateDetails';
const draft: DetailsDraft = {
  contact: {
    email: 'ava@example.test',
    password: 'Sunny-days-42',
    firstName: 'Ava',
    lastName: 'Mitchell',
    phone: '021 555 0199',
    address: '',
  },
  pets: [],
  dropOffTime: '09:00',
  pickUpTime: '17:00',
  careNotes: '',
  termsAccepted: true,
  vetConsent: true,
};
describe('optional emergency number validation', () => {
  it('allows both optional fields to stay empty', () =>
    expect(validateDetails(draft, true)).toEqual({}));
  it('reports a malformed number only when provided', () =>
    expect(
      validateDetails(
        { ...draft, contact: { ...draft.contact, emergencyContactNumber: 'bad' } },
        true,
      ),
    ).toHaveProperty('emergencyContactNumber'));
});

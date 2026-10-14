import { isValidPhoneNumber } from '../../../shared/utils/phone';
import type { DetailsField } from '../copy';
import { meetsPasswordRules } from '../../../shared/auth/passwordRules';

/**
 * The checkout form's rules, the same ones the server's zod schema applies
 * (Backend/src/contracts/concierge.contract.ts), so a guest learns what is missing at the field
 * instead of from a refused request at the very last step. Pure, so it is tested on its own.
 *
 * The form asks only what the request needs: names and a mobile for a new guest, an optional home
 * address, the pets, the times, the booking terms and consent to the card rules. There is an optional
 * emergency contact and no typed signature: the agreement is recorded under the guest's own name
 * (owner decision of 2026-09-29).
 */

export interface DetailsPetDraft {
  /** A saved pet's id, or null to describe a new pet. */
  existingPetId: string | null;
  name: string;
  breed: string;
}

/** The shape the server accepts; it checks the address again. */
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailAddress = (value: string): boolean =>
  value.length <= 254 && EMAIL_ADDRESS.test(value);

export interface DetailsContactDraft {
  /** A first-time guest's email; their account is made with it. Never kept in the tab. */
  email: string;
  /** The password for that account. Never kept in the tab, never logged. */
  password: string;
  firstName: string;
  lastName: string;
  /** Optional: left empty, it is not sent at all. */
  address: string;
  emergencyContactNumber?: string;
  phone: string;
}

export interface DetailsDraft {
  contact: DetailsContactDraft;
  pets: DetailsPetDraft[];
  dropOffTime: string;
  pickUpTime: string;
  careNotes: string;
  /** The box for the booking terms. Never ticked for the parent, and never kept on reload. */
  termsAccepted: boolean;
  /** Emergency vet consent, its own box. Never ticked for the parent, and never kept on reload. */
  vetConsent: boolean;
}

/** Keyed by the field's form key: "firstName", "pets.1.name", "vetConsent"… */
export type DetailsErrors = Partial<Record<string, DetailsField>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_ADDRESS_LENGTH = 5;
/** The schema's maximums. */
export const MAX_LENGTHS = {
  name: 100,
  address: 300,
  phone: 20,
  petName: 100,
  breed: 100,
} as const;

export const petNameKey = (index: number): string => `pets.${index}.name`;
export const petBreedKey = (index: number): string => `pets.${index}.breed`;

const tooLong = (value: string, max: number): boolean => value.trim().length > max;

const addressProblem = (address: string): DetailsField | null => {
  const length = address.trim().length;
  if (length === 0) return null;
  if (length < MIN_ADDRESS_LENGTH) return 'address';
  return tooLong(address, MAX_LENGTHS.address) ? 'addressTooLong' : null;
};

export const validateDetails = (draft: DetailsDraft, needsContact: boolean): DetailsErrors => {
  const errors: DetailsErrors = {};
  if (needsContact) {
    const { contact } = draft;
    if (!isEmailAddress(contact.email.trim())) errors.email = 'email';
    if (!meetsPasswordRules(contact.password)) errors.password = 'password';
    if (!contact.firstName.trim()) errors.firstName = 'firstName';
    else if (tooLong(contact.firstName, MAX_LENGTHS.name)) errors.firstName = 'nameTooLong';
    if (!contact.lastName.trim()) errors.lastName = 'lastName';
    else if (tooLong(contact.lastName, MAX_LENGTHS.name)) errors.lastName = 'nameTooLong';
    const emergencyNumber = contact.emergencyContactNumber?.trim();
    if (
      emergencyNumber &&
      (emergencyNumber.length > MAX_LENGTHS.phone || !isValidPhoneNumber(emergencyNumber))
    ) {
      errors.emergencyContactNumber = 'emergencyContactNumber';
    }
    const address = addressProblem(contact.address);
    if (address) errors.address = address;
    if (tooLong(contact.phone, MAX_LENGTHS.phone)) errors.phone = 'phoneTooLong';
    else if (!isValidPhoneNumber(contact.phone)) errors.phone = 'phone';
  }
  draft.pets.forEach((pet, index) => {
    if (pet.existingPetId) return;
    if (!pet.name.trim()) errors[petNameKey(index)] = 'petName';
    else if (tooLong(pet.name, MAX_LENGTHS.petName)) errors[petNameKey(index)] = 'nameTooLong';
    if (tooLong(pet.breed, MAX_LENGTHS.breed)) errors[petBreedKey(index)] = 'breedTooLong';
  });
  if (!TIME.test(draft.dropOffTime)) errors.dropOffTime = 'dropOffTime';
  if (!TIME.test(draft.pickUpTime)) errors.pickUpTime = 'pickUpTime';
  if (!draft.termsAccepted) errors.termsAccepted = 'termsAccepted';
  if (!draft.vetConsent) errors.vetConsent = 'vetConsent';
  return errors;
};

/** Server field paths ("contact.phone", "pets.0.newPet.breed") to this form's keys. */
export const formKeyForServerField = (field: string): string | null => {
  if (field === 'newAccount.email') return 'email';
  if (field === 'newAccount.password') return 'password';
  if (field.startsWith('contact.')) return field.slice('contact.'.length);
  const breed = /^pets\.(\d+)\.newPet\.breed$/.exec(field);
  if (breed?.[1]) return petBreedKey(Number(breed[1]));
  const pet = /^pets\.(\d+)\./.exec(field);
  if (pet?.[1]) return petNameKey(Number(pet[1]));
  if (field === 'stay.dropOffTime') return 'dropOffTime';
  if (field === 'stay.pickUpTime') return 'pickUpTime';
  if (field === 'agreement.termsAccepted') return 'termsAccepted';
  if (field === 'agreement.vetConsentAccepted') return 'vetConsent';
  return null;
};

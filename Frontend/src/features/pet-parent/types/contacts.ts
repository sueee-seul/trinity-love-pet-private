/**
 * The emergency contact a parent names on their account (`account_contacts`). Mirrors
 * Backend/src/contracts/account-contacts.contract.ts.
 */

export const CONTACT_ROLES = ['emergency'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface AccountContact {
  id: string;
  role: ContactRole;
  name: string;
  phone: string | null;
  relationship: string | null;
  /** When the parent confirmed they told this person we hold their details; null until they do. */
  informedAt: string | null;
  createdAt: string;
}

/** A new contact. An emergency contact needs a phone; the server refuses one without. */
export interface ContactInput {
  role: ContactRole;
  name: string;
  phone?: string | null;
  relationship?: string | null;
  /** True when the parent ticks "I have told this person that Wagstay holds their details". */
  informed: boolean;
}

export type ContactUpdate = Partial<
  Pick<ContactInput, 'name' | 'phone' | 'relationship' | 'informed'>
>;

export interface ContactsResponse {
  contacts: AccountContact[];
}

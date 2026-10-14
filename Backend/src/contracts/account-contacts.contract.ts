import { z } from 'zod';

/**
 * The emergency contact a parent names on their account (`account_contacts`): someone we can reach
 * when the parent cannot be reached. The parent confirms they told the person we hold their details
 * (Privacy Act 2020 IPP 3A). Mirrored by Frontend/src/features/pet-parent/types/contacts.ts.
 *
 * The table also holds 'pickup' rows from the pick-up coordination removed on 7 Oct 2026 at the
 * owner's request; they stay in the database but are never read or written again.
 */

export const CONTACT_ROLES = ['emergency'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface AccountContact {
  id: string;
  role: ContactRole;
  name: string;
  phone: string | null;
  relationship: string | null;
  /** When the parent confirmed they told this person; null until they do. */
  informedAt: string | null;
  createdAt: string;
}

const nameSchema = z.string().trim().min(1).max(120);
const phoneSchema = z.string().trim().min(5).max(40).nullable().optional();
const relationshipSchema = z.string().trim().max(80).nullable().optional();

export const contactInputSchema = z
  .object({
    role: z.enum(CONTACT_ROLES),
    name: nameSchema,
    phone: phoneSchema,
    relationship: relationshipSchema,
    /** True when the parent ticks "I have told this person we hold their details". */
    informed: z.boolean().default(false),
  })
  .strict()
  .refine((contact) => Boolean(contact.phone), {
    message: 'An emergency contact needs a phone number',
    path: ['phone'],
  });
export type ContactInput = z.infer<typeof contactInputSchema>;

export const contactUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema,
    relationship: relationshipSchema,
    informed: z.boolean().optional(),
  })
  .strict()
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: 'Nothing to change',
  });
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

export interface ContactsResponse {
  contacts: AccountContact[];
}

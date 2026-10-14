/**
 * The note the booking concierge writes into a stay's `medication_instructions` when the owner
 * said the pet needs medication but gave no medicine, dose or times. It is a note for staff, not
 * instructions, so the "Get ready" list must not count it as the stay's medication instructions.
 * The writer (services/concierge/concierge.checkout.ts) and the reader
 * (repositories/petparent.getReady.repository.ts) share this one value so they cannot drift.
 */
export const OWNER_SAID_NEEDS_MEDICATION_NOTE =
  'Owner said this pet needs medication; confirm the medicine, dose and times with them.';

// Pure rules behind the pet-parent homepage and the Vaccination information
// page. No I/O here so the state model and checklist can be unit-tested without
// a database (see docs/homepage-backend-plan.md §4).

export type HomeState = 'A' | 'B1' | 'B2' | 'C1' | 'C2';
export type ChecklistStatus = 'done' | 'outstanding';
export type ChecklistKey = 'agreement' | 'payment' | 'vaccination' | 'admission';

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  status: ChecklistStatus;
  /** Outstanding items normally open a page; admission verification has none yet. */
  tappable: boolean;
  /** Only on `vaccination`: the booking pets whose certificate is still missing. */
  bookingPetIds?: string[];
}

export interface VaccinationFacts {
  fullyVaccinated: boolean | null;
  hasVaccinationCertificate: boolean;
}

// Done only when the parent answered Yes and uploaded the certificate for this stay (the
// Vaccination information page saves both together). A Yes on its own is only a claim: the Code of
// Welfare asks for evidence that shows the dates (MS 6(b), 6(c)), so the item stays outstanding.
export const vaccinationStatusOf = (facts: VaccinationFacts): ChecklistStatus =>
  facts.fullyVaccinated === true && facts.hasVaccinationCertificate ? 'done' : 'outstanding';

export const resolveHomeState = (input: {
  petCount: number;
  hasUpcomingStay: boolean;
  hasPastStays: boolean;
}): HomeState => {
  if (input.petCount === 0) return 'A';
  if (input.hasUpcomingStay) return input.hasPastStays ? 'C2' : 'C1';
  return input.hasPastStays ? 'B2' : 'B1';
};

const startOfLocalDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Whole calendar days from `now` to drop-off, never negative. The concierge
 * checkout writes drop-off with `newZealandWallClockToDate`, so the stored
 * instant is Auckland time. This counts days on the server's local calendar,
 * which agrees with the date the parent picked only while the server runs in
 * Auckland time; on a UTC host it can be one day off near midnight.
 */
export const daysToGo = (dropOff: Date, now: Date): number =>
  Math.max(Math.round((startOfLocalDay(dropOff) - startOfLocalDay(now)) / 86_400_000), 0);

export interface ChecklistInput {
  hasAgreement: boolean;
  paymentSucceeded: boolean;
  cardSaved?: boolean;
  approved?: boolean;
  paymentTestMode?: boolean;
  pets: (VaccinationFacts & { bookingPetId: string })[];
}

/**
 * A saved card is not a payment, and test money is never called paid. The task itself is saving a
 * card for an approved stay, so a test card completes it too, under a label that says no real
 * money is involved; otherwise a test stay would show a task nobody could ever finish.
 */
const paymentChecklistItem = (input: ChecklistInput): ChecklistItem => {
  const approved = input.approved === true;
  const test = input.paymentTestMode === true;
  const paid = input.paymentSucceeded && !test;
  const saved = input.cardSaved === true;
  const card = test ? 'Test card saved' : 'Card saved';
  const testNote = test ? ' (no real payment)' : '';
  const label = paid
    ? 'Paid'
    : saved
      ? `${card}${approved ? '' : ' · awaiting approval'}${testNote}`
      : 'Card not saved';
  return {
    key: 'payment',
    label,
    status: approved && (paid || saved) ? 'done' : 'outstanding',
    tappable: !paid && !saved,
  };
};

/** Always all four items, always in this order, so the list never reorders. */
export const buildChecklist = (input: ChecklistInput): ChecklistItem[] => {
  const missingVaccination = input.pets
    .filter((pet) => vaccinationStatusOf(pet) === 'outstanding')
    .map((pet) => pet.bookingPetId);

  return [
    {
      key: 'agreement',
      label: 'Agreement signed',
      status: input.hasAgreement ? 'done' : 'outstanding',
      tappable: !input.hasAgreement,
    },
    paymentChecklistItem(input),
    {
      key: 'vaccination',
      label: 'Vaccination information',
      status: missingVaccination.length === 0 ? 'done' : 'outstanding',
      tappable: missingVaccination.length > 0,
      ...(missingVaccination.length > 0 ? { bookingPetIds: missingVaccination } : {}),
    },
    // No admission-verification concept exists yet (plan §5.1), so it is always
    // outstanding and not tappable until product defines it.
    { key: 'admission', label: 'Admission verification', status: 'outstanding', tappable: false },
  ];
};

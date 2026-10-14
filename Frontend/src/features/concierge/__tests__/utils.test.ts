import { describe, expect, it } from 'vitest';
import { ApiError } from '../../pet-parent/api/bookingApi';
import { CONCIERGE_COPY } from '../copy';
import { createEmptyNeeds } from '../store/conciergeStore';
import { reviveSnapshot, SNAPSHOT_VERSION, type ConciergeSnapshot } from '../store/persistence';
import type { ConciergeNeeds } from '../types';
import { describeConciergeError } from '../utils/conciergeErrors';
import { aucklandWallClockToUtc, buildStayCalendar } from '../utils/ics';
import { priceUnitLabel } from '../utils/format';
import { buildPlanSummary } from '../utils/planSummary';
import { buildQuickReplies } from '../utils/quickReplies';
import { normaliseSpecies } from '../utils/species';
import { stayNameText } from '../utils/stayName';
import { catalogue, quoteFor, roomierCombo } from './fixtures';
import {
  formKeyForServerField,
  validateDetails,
  type DetailsDraft,
} from '../utils/validateDetails';

const EN = CONCIERGE_COPY.en;
const TODAY = '2026-09-28';

const dog = { species: 'dog' as const, size: null, needsMedication: null, firstTimeBoarding: null };

const needsWith = (overrides: Partial<ConciergeNeeds>): ConciergeNeeds => ({
  ...createEmptyNeeds(),
  ...overrides,
});

const completeDraft = (): DetailsDraft => ({
  contact: {
    email: 'ava@example.test',
    password: 'Sunny-days-42',
    firstName: 'Ava',
    lastName: 'Mitchell',
    address: '12 Queen Street, Auckland',
    phone: '021 555 0199',
  },
  pets: [{ existingPetId: null, name: 'Biscuit', breed: '' }],
  dropOffTime: '09:00',
  pickUpTime: '17:00',
  careNotes: '',
  termsAccepted: true,
  vetConsent: true,
});

describe('validateDetails', () => {
  it('accepts a complete form', () => {
    expect(validateDetails(completeDraft(), true)).toEqual({});
  });

  it('names every missing or malformed field, with the server’s phone rule', () => {
    const draft = completeDraft();
    draft.contact.email = 'ava@';
    draft.contact.password = 'short';
    draft.contact.phone = '';
    draft.contact.address = 'x';
    draft.pets = [{ existingPetId: null, name: ' ', breed: '' }];
    draft.termsAccepted = false;
    draft.vetConsent = false;

    expect(validateDetails(draft, true)).toEqual({
      email: 'email',
      password: 'password',
      address: 'address',
      phone: 'phone',
      'pets.0.name': 'petName',
      termsAccepted: 'termsAccepted',
      vetConsent: 'vetConsent',
    });
  });

  it('lets the home address be left empty', () => {
    const draft = completeDraft();
    draft.contact.address = '   ';

    expect(validateDetails(draft, true)).toEqual({});
  });

  it('asks a signed-in owner for nothing about themselves, and nothing about a saved pet', () => {
    const draft = completeDraft();
    draft.contact.phone = '';
    draft.pets = [{ existingPetId: 'saved-pet', name: '', breed: '' }];

    expect(validateDetails(draft, false)).toEqual({});
  });

  it('still needs the terms and the vet consent from a signed-in owner', () => {
    const draft = completeDraft();
    draft.termsAccepted = false;
    draft.vetConsent = false;

    expect(validateDetails(draft, false)).toEqual({
      termsAccepted: 'termsAccepted',
      vetConsent: 'vetConsent',
    });
  });

  it('holds a first-time guest’s password to the sign-up rule', () => {
    for (const password of ['Sunny-days', 'sunnydays42', ' Sunny-days-42', 'S-1']) {
      const draft = completeDraft();
      draft.contact.password = password;
      expect(validateDetails(draft, true)).toEqual({ password: 'password' });
    }
  });

  it('maps the server’s field paths onto the form', () => {
    expect(formKeyForServerField('newAccount.email')).toBe('email');
    expect(formKeyForServerField('newAccount.password')).toBe('password');
    expect(formKeyForServerField('contact.phone')).toBe('phone');
    expect(formKeyForServerField('pets.1.newPet.name')).toBe('pets.1.name');
    expect(formKeyForServerField('agreement.termsAccepted')).toBe('termsAccepted');
    expect(formKeyForServerField('acceptedQuoteToken')).toBeNull();
  });
});

describe('buildQuickReplies', () => {
  const input = {
    copy: EN,
    comboCount: 0,
    isFirstTurn: false,
    today: TODAY,
  };

  it('starts with one-tap starters before the guest has said anything', () => {
    const group = buildQuickReplies({
      ...input,
      needs: createEmptyNeeds(),
      missingFields: ['dates', 'pets'],
      isFirstTurn: true,
    });
    expect(group?.replies.map((reply) => reply.label)).toEqual([
      'A stay for my dog',
      'A stay for my cat',
      'More than one pet',
      'Talk to a person',
    ]);
  });

  it('answers the question the assistant just asked: dates, then pets, then species', () => {
    expect(
      buildQuickReplies({ ...input, needs: createEmptyNeeds(), missingFields: ['dates', 'pets'] })
        ?.replies[0]?.kind,
    ).toBe('dates');

    const pets = buildQuickReplies({
      ...input,
      needs: createEmptyNeeds(),
      missingFields: ['pets'],
    });
    const twoDogs = pets?.replies.find((reply) => reply.label === '2 dogs');
    expect(twoDogs?.kind === 'answer' && twoDogs.apply(createEmptyNeeds()).pets).toHaveLength(2);

    const species = buildQuickReplies({
      ...input,
      needs: needsWith({ pets: [dog, { ...dog, species: null }] }),
      missingFields: ['species'],
    });
    expect(species?.label).toBe('Pet 2 is a…');
  });

  it('once options are ready, offers the size, then medication per pet, and the stay', () => {
    const ready = { ...input, missingFields: [] as never[], comboCount: 3 };
    const size = buildQuickReplies({ ...ready, needs: needsWith({ pets: [dog] }) });
    expect(size?.label).toBe('Pet 1 size');
    expect(size?.replies.at(-1)?.label).toBe('Open my stay');

    const twoSized = needsWith({
      pets: [
        { ...dog, size: 'large' },
        { ...dog, size: 'small' },
      ],
    });
    const medication = buildQuickReplies({ ...ready, needs: twoSized });
    expect(medication?.replies.map((reply) => reply.label)).toEqual([
      'No medication',
      'Pet 1 does',
      'Pet 2 does',
      'All of them',
      'Open my stay',
    ]);
    const second = medication?.replies[2];
    expect(
      second?.kind === 'answer' && second.apply(twoSized).pets.map((pet) => pet.needsMedication),
    ).toEqual([false, true]);
  });

  it('offers "same as last time" first, only while there is an earlier stay to copy', () => {
    const starters: Parameters<typeof buildQuickReplies>[0] = {
      ...input,
      needs: createEmptyNeeds(),
      missingFields: ['dates', 'pets'],
      isFirstTurn: true,
    };
    const labels = (group: ReturnType<typeof buildQuickReplies>): string[] =>
      group?.replies.map((reply) => reply.label) ?? [];
    // A guest, or a parent with no earlier stay, sees the plain starters.
    expect(labels(buildQuickReplies(starters))).not.toContain('Same as last time');

    const chip = buildQuickReplies({ ...starters, hasLastStay: true })?.replies[0];
    expect(chip).toEqual({
      kind: 'say',
      id: 'same-as-last-time',
      label: 'Same as last time',
      message: 'Same as last time',
    });
    const chinese = buildQuickReplies({ ...starters, copy: CONCIERGE_COPY.zh, hasLastStay: true })
      ?.replies[0];
    expect(chinese?.kind === 'say' && chinese.message).toBe('和上次一样');

    // Gone once the guest has said something, or once pets are in the plan.
    expect(
      labels(buildQuickReplies({ ...starters, hasLastStay: true, isFirstTurn: false })),
    ).not.toContain('Same as last time');
    expect(
      labels(
        buildQuickReplies({ ...starters, hasLastStay: true, needs: needsWith({ pets: [dog] }) }),
      ),
    ).not.toContain('Same as last time');
  });

  it('asks for dates again when the chosen ones cannot be quoted', () => {
    const group = buildQuickReplies({
      ...input,
      needs: needsWith({ startDate: '2026-10-15', endDate: '2026-10-12', pets: [dog] }),
      missingFields: ['dates'],
    });
    expect(group?.replies[0]?.kind).toBe('dates');
  });
});

describe('describeConciergeError', () => {
  it('reads the reason and recovery details from the server’s error body', () => {
    const expired = describeConciergeError(
      new ApiError('expired', 410, {
        error: { code: 'CONCIERGE_TOKEN_INVALID', details: [{ token: 'verified_email' }] },
      }),
      EN,
    );
    expect(expired.token).toBe('verified_email');

    const sent = describeConciergeError(
      new ApiError('sent', 409, {
        error: {
          code: 'CONCIERGE_ALREADY_SUBMITTED',
          details: [{ confirmationNumber: 'PB-ABC123' }],
        },
      }),
      EN,
    );
    expect(sent.message).toContain('PB-ABC123');

    const cooldown = describeConciergeError(
      new ApiError('wait', 429, {
        error: { code: 'CONCIERGE_CODE_COOLDOWN', details: [{ retryAfterSeconds: 42 }] },
      }),
      EN,
    );
    expect(cooldown.message).toBe('Please wait 42 seconds before asking for another code.');
  });

  it('never shows the server’s English text on the Chinese page', () => {
    const problem = describeConciergeError(
      new ApiError('That code is not right', 400, { error: { code: 'CONCIERGE_CODE_INVALID' } }),
      CONCIERGE_COPY.zh,
    );
    expect(problem.message).toMatch(/验证码/);
  });

  // Regression: these three fell through to "Something went wrong", which told the guest nothing.
  it.each([
    ['TERMS_VERSION_CHANGED', 409, /terms have changed/, /条款已经更新/],
    ['TERMS_UNAVAILABLE', 503, /terms can’t be loaded/, /条款暂时无法加载/],
    ['AGREEMENT_NAME_MISSING', 422, /add your name/, /填写你的姓名/],
  ])('says what %s means instead of the general message', (code, status, english, chinese) => {
    const refusal = new ApiError('refused', status, { error: { code } });

    expect(describeConciergeError(refusal, EN).message).toMatch(english);
    expect(describeConciergeError(refusal, CONCIERGE_COPY.zh).message).toMatch(chinese);
  });

  it('says in plain words that nights filled up while the guest was booking', () => {
    const full = describeConciergeError(
      new ApiError('full', 409, {
        error: { code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-10-13' }] },
      }),
      EN,
    );
    expect(full.code).toBe('CONCIERGE_FULLY_BOOKED');
    expect(full.message).toBe(
      'Sorry, some of those nights just filled up. Please choose other dates.',
    );
  });

  it('lists the fields a validation failure refused', () => {
    const problem = describeConciergeError(
      new ApiError('Invalid', 400, {
        error: { code: 'VALIDATION_FAILED', details: [{ field: 'contact.phone', issue: 'bad' }] },
      }),
      EN,
    );
    expect(problem.fields).toEqual(['contact.phone']);
  });
});

describe('reviveSnapshot', () => {
  const NOW = Date.parse('2026-10-01T02:00:00.000Z');
  const snapshot = (overrides: Partial<ConciergeSnapshot>): ConciergeSnapshot => ({
    version: SNAPSHOT_VERSION,
    savedAt: NOW - 60_000,
    locale: 'en',
    step: 'plan',
    messages: [],
    needs: createEmptyNeeds(),
    missingFields: [],
    combos: [],
    catalogue,
    selection: null,
    stayQuote: null,
    appliedComboId: null,
    customised: false,
    assistantMode: 'rules',
    accepted: null,
    agreedQuote: null,
    verifiedEmail: null,
    verificationToken: null,
    verifiedAt: null,
    detailsDraft: null,
    checkoutResult: null,
    booked: null,
    savedPetLinks: [],
    pricedNeeds: null,
    agreedNeeds: null,
    savedPets: {},
    ...overrides,
  });

  it('drops a plan older than two hours', () => {
    expect(reviveSnapshot(snapshot({ savedAt: NOW - 3 * 60 * 60_000 }), NOW)).toBeNull();
  });

  it('drops expired prices and proofs, and never reopens a step it can no longer show', () => {
    const lapsed = {
      ...roomierCombo,
      quote: { ...roomierCombo.quote, expiresAt: '2026-10-01T01:00:00.000Z' },
    };
    const revived = reviveSnapshot(
      snapshot({
        step: 'details',
        combos: [lapsed],
        selection: lapsed.quote.selection,
        stayQuote: lapsed.quote,
        appliedComboId: lapsed.id,
        accepted: {
          acceptedQuoteToken: 'accepted',
          acceptedAt: '2026-10-01T00:30:00.000Z',
          name: lapsed.quote.name,
          total: lapsed.quote.total,
        },
        agreedQuote: lapsed.quote,
        verificationToken: 'verified',
        verifiedAt: NOW - 90 * 60_000,
        verifiedEmail: 'ava@example.com',
      }),
      NOW,
    );
    expect(revived?.combos).toEqual([]);
    expect(revived?.stayQuote).toBeNull();
    expect(revived?.appliedComboId).toBeNull();
    // The hand-built choices stay, so they are priced again instead of lost.
    expect(revived?.selection).toEqual(lapsed.quote.selection);
    expect(revived?.accepted).toBeNull();
    expect(revived?.agreedQuote).toBeNull();
    expect(revived?.verificationToken).toBeNull();
    expect(revived?.step).toBe('plan');
  });

  it('reopens the sign-in step with its agreement when the plan was saved there', () => {
    const revived = reviveSnapshot(
      snapshot({
        step: 'verify',
        accepted: {
          acceptedQuoteToken: 'accepted',
          acceptedAt: '2026-10-01T01:50:00.000Z',
          name: roomierCombo.quote.name,
          total: roomierCombo.quote.total,
        },
        agreedQuote: roomierCombo.quote,
      }),
      NOW,
    );
    expect(revived?.step).toBe('verify');
    expect(revived?.accepted?.acceptedQuoteToken).toBe('accepted');
  });
});

describe('calendar file', () => {
  it('turns Auckland wall-clock times into the right instant, summer time included', () => {
    // 12 Oct 2026 is NZ daylight time (UTC+13); 12 Jun 2026 is standard time (UTC+12).
    expect(aucklandWallClockToUtc('2026-10-12', '09:00').toISOString()).toBe(
      '2026-10-11T20:00:00.000Z',
    );
    expect(aucklandWallClockToUtc('2026-06-12', '09:00').toISOString()).toBe(
      '2026-06-11T21:00:00.000Z',
    );
  });

  it('builds a two-event calendar with reminders and escaped text', () => {
    const file = buildStayCalendar({
      title: 'Pet stay request (not yet confirmed)',
      reference: 'PB-AAAAAA',
      startDate: '2026-10-12',
      endDate: '2026-10-15',
      dropOffTime: '09:00',
      pickUpTime: '17:00',
      dropOffLabel: 'Drop-off; Wagstay',
      pickUpLabel: 'Pick-up, Wagstay',
      now: new Date('2026-09-28T00:00:00.000Z'),
    });
    expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(file).toContain('PRODID:-//Wagstay//Booking//EN');
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(file).toContain('UID:PB-AAAAAA-drop-off@wagstay');
    expect(file).toContain('UID:PB-AAAAAA-pick-up@wagstay');
    expect(file).toContain('DTSTART:20261011T200000Z');
    expect(file).toContain('DTSTART:20261015T040000Z');
    expect(file).toContain('SUMMARY:Drop-off\\; Wagstay');
    expect(file).toContain('SUMMARY:Pick-up\\, Wagstay');
    expect(file).toContain('TRIGGER:-P1D');
  });

  it('says what to bring in the drop-off reminder the day before', () => {
    const file = buildStayCalendar({
      title: 'Pet stay at Wagstay',
      reference: 'PB-AAAAAA',
      startDate: '2026-10-12',
      endDate: '2026-10-15',
      dropOffTime: '09:00',
      pickUpTime: '17:00',
      dropOffLabel: 'Drop-off',
      pickUpLabel: 'Pick-up',
      dropOffReminder: 'Bring the vaccination certificate and sign the consent.',
      now: new Date('2026-09-28T00:00:00.000Z'),
    });
    const [dropOff, pickUp] = file.split('BEGIN:VEVENT').slice(1);

    expect(dropOff).toContain(
      'DESCRIPTION:Pet stay at Wagstay · PB-AAAAAA\\nBring the vaccination certificate and sign the consent.',
    );
    expect(dropOff).toContain(
      'DESCRIPTION:Drop-off: Bring the vaccination certificate and sign the consent.',
    );
    expect(pickUp).not.toContain('vaccination');
  });
});

describe('stay names and plan summary', () => {
  it('names a stay from its lines the way the server does, in the reader’s language', () => {
    const lines = roomierCombo.quote.lines;
    expect(stayNameText(lines, [], EN, 'en')).toBe(roomierCombo.quote.name);
    expect(stayNameText(lines, [], CONCIERGE_COPY.zh, 'zh')).toBe('豪华套房、店内干粮、户外散步');
  });

  it('names each pet’s choice when pets differ, by name or by position', () => {
    const twoPets = quoteFor(
      [
        { roomId: 'room-deluxe', foodId: 'food-house', addonIds: [] },
        { roomId: 'room-standard', foodId: 'food-house', addonIds: [] },
      ],
      'two',
    );
    expect(stayNameText(twoPets.lines, ['Max', undefined], EN, 'en')).toBe(
      'Max: Deluxe suite and House food; Pet 2: Standard room and House food',
    );
  });

  it('writes the plan without any contact details', () => {
    const summary = buildPlanSummary(
      EN,
      'en',
      needsWith({
        startDate: '2026-10-12',
        endDate: '2026-10-15',
        pets: [{ ...dog, size: 'large', name: 'Biscuit' }],
        extras: { walks: true, grooming: false, playtime: false },
      }),
      roomierCombo.quote,
    );
    expect(summary).toContain('3 nights');
    expect(summary).toContain('Dog (Large)');
    expect(summary).toContain('Stay: Deluxe suite, House food and Outdoor walk');
    expect(summary).toContain('$267.00');
    expect(summary).not.toContain('Biscuit');
  });

  it('reads saved species written as free text, and never guesses', () => {
    expect(normaliseSpecies('Dog')).toBe('dog');
    expect(normaliseSpecies('猫咪')).toBe('cat');
    expect(normaliseSpecies('Rabbit')).toBe('other');
    expect(normaliseSpecies(undefined)).toBe('other');
  });
});

describe('review regressions', () => {
  it('rejects values the server would refuse for length, and points a breed error at the breed', () => {
    const draft = completeDraft();
    draft.contact.phone = '+64 (0) 21 - 555 - 0101';
    draft.pets = [{ existingPetId: null, name: 'Biscuit', breed: 'x'.repeat(101) }];
    const errors = validateDetails(draft, true);
    expect(errors.phone).toBe('phoneTooLong');
    expect(errors['pets.0.breed']).toBe('breedTooLong');
    expect(formKeyForServerField('pets.0.newPet.breed')).toBe('pets.0.breed');
  });

  it('asks about medication before size when several pets are staying', () => {
    const twoDogs = needsWith({ pets: [dog, { ...dog }] });
    const group = buildQuickReplies({
      copy: EN,
      needs: twoDogs,
      missingFields: [],
      comboCount: 3,
      isFirstTurn: false,
      today: TODAY,
    });
    expect(group?.label).toBe('Does anyone take medication?');
  });

  it('shows catalogue units in the page language and never raw English', () => {
    expect(priceUnitLabel(CONCIERGE_COPY.zh, 'per stay')).toBe('每次寄养');
    expect(priceUnitLabel(CONCIERGE_COPY.zh, 'per fortnight')).toBe('');
  });
});

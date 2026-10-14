import { describe, expect, it } from 'vitest';
import {
  cardHoldFailedEmail,
  dropOffReminderEmail,
  type BookingEmailDetails,
} from '../services/booking.reminder-emails.js';

const details = (overrides: Partial<BookingEmailDetails> = {}): BookingEmailDetails => ({
  to: 'ava@example.test',
  firstName: 'Ava',
  reference: 'PB-1A2B3C',
  // 10:30 on Sat 12 Dec to 16:00 on Tue 15 Dec 2026, in Auckland (NZDT).
  dropOffAt: new Date('2026-12-11T21:30:00Z'),
  pickUpAt: new Date('2026-12-15T03:00:00Z'),
  petNames: ['Biscuit', 'Mochi'],
  amount: 460,
  testMode: false,
  contact: { email: 'bookings@wagstay.example', phone: '09 555 0100' },
  ...overrides,
});

describe('booking reminder emails', () => {
  it('tells the guest when to come, what to bring and what the card is doing, in Auckland time', () => {
    const email = dropOffReminderEmail({
      ...details(),
      cancellationFee: 230,
      paid: false,
      schedule: 'first_night',
    });

    expect(email.to).toBe('ava@example.test');
    expect(email.subject).toBe('Your Wagstay stay starts Sat 12 Dec: what to bring');
    const lines = email.text.split('\n');
    expect(lines[0]).toBe('Hi Ava,');
    expect(lines).toContain('Reference: PB-1A2B3C');
    expect(lines).toContain('Check-in: Sat 12 Dec, 10:30');
    expect(lines).toContain('Check-out: Tue 15 Dec, 16:00');
    expect(lines).toContain('Pets: Biscuit and Mochi');
    expect(email.text).toContain(
      "1. Your pet's current vaccination certificate (C5 for dogs, F3 for cats).",
    );
    expect(email.text).toContain(
      'Emergency vet consent up to NZ$500 is included in the current online booking terms.',
    );
    expect(email.text).toContain(
      'it counts as not coming, which costs the first night for each approved pet (excluding one-off extras).',
    );
    expect(email.text).toContain(
      "Payment: we've held $460.00 on your card. We charge it only when you check in.",
    );
    expect(email.text).toContain(
      'Cancelling now costs $230.00. My Stays shows your current cancellation fee before you confirm.',
    );
    expect(email.text).toContain(
      'For an emergency or a sick pet, email bookings@wagstay.example or call 09 555 0100: we can cancel or move the stay without a fee.',
    );
    expect(email.text).not.toContain('test booking');
  });

  it('asks for another card when the hold was refused, and still lists what to bring', () => {
    const email = cardHoldFailedEmail(details({ contact: { email: null, phone: '09 555 0100' } }));

    expect(email.subject).toBe("Action needed: we couldn't hold your card for your Wagstay stay");
    expect(email.text).toContain(
      "We tried to hold $460.00 on your card for your stay, but your bank didn't allow it.",
    );
    expect(email.text).toContain(
      'Your booking is still in place. To give us another card before check-in, call 09 555 0100.',
    );
    expect(email.text).toContain('Check-in: Sat 12 Dec, 10:30');
    expect(email.text).toContain('vaccination certificate');
  });

  it('says plainly when the booking is a test', () => {
    expect(
      dropOffReminderEmail({
        ...details({ testMode: true }),
        cancellationFee: 230,
        paid: false,
        schedule: 'first_night',
      }).text,
    ).toContain('This is a test booking: no real card was held.');
    expect(cardHoldFailedEmail(details({ testMode: true })).text).toContain(
      'This is a test booking: no real money moves.',
    );
  });

  it('still reads well without a first name, a team contact or a fee', () => {
    const email = dropOffReminderEmail({
      ...details({ firstName: null, petNames: ['Biscuit'], contact: { email: null, phone: null } }),
      paid: false,
      schedule: 'first_night',
      cancellationFee: null,
    });

    expect(email.text.startsWith('Hello,\n')).toBe(true);
    expect(email.text).toContain('Pets: Biscuit\n');
    expect(email.text).toContain('For an emergency or a sick pet, reply to this email:');
  });

  it('states a fee only when one applies, never a free cancellation that may end soon', () => {
    const email = dropOffReminderEmail({
      ...details(),
      cancellationFee: 0,
      paid: false,
      schedule: 'first_night',
    });

    expect(email.text).not.toMatch(/cancel for free|Cancelling now costs/i);
    expect(email.text).toContain(
      'My Stays shows your current cancellation fee before you confirm.',
    );
  });

  it('says a paid stay is paid, with the half-stay no-show fee of the current terms', () => {
    const email = dropOffReminderEmail({
      ...details(),
      cancellationFee: 115,
      paid: true,
      schedule: 'tiered',
    });

    expect(email.text).toContain(
      "Payment: you've paid $460.00. Anything you don't owe after check-in goes back to your card.",
    );
    expect(email.text).toContain("Not coming costs half of each confirmed pet's stay.");
    expect(email.text).not.toContain('We charge it only when you check in.');
  });

  it('tells a guest under the current terms that a pet without proof still stays, at no cost', () => {
    const email = dropOffReminderEmail({
      ...details(),
      cancellationFee: 0,
      paid: true,
      schedule: 'tiered',
    });

    expect(email.text).toContain(
      "If you can't bring the vaccination certificate, your pet still stays with us, kept apart from other pets, at no extra cost.",
    );
    expect(email.text).not.toContain('it counts as not coming');
  });

  it('keeps the no-show rule a 2026-10-02 booking agreed to', () => {
    const email = dropOffReminderEmail({
      ...details(),
      cancellationFee: 0,
      paid: true,
      schedule: 'tiered_with_grace',
    });

    expect(email.text).toContain(
      "it counts as not coming, which costs half of each confirmed pet's stay.",
    );
  });

  it('never uses an em dash', () => {
    const texts = [
      dropOffReminderEmail({
        ...details({ testMode: true }),
        cancellationFee: 0,
        paid: false,
        schedule: 'first_night',
      }),
      dropOffReminderEmail({ ...details(), cancellationFee: 0, paid: true, schedule: 'tiered' }),
      cardHoldFailedEmail(details({ testMode: true })),
    ].flatMap((email) => [email.subject, email.text]);

    for (const text of texts) expect(text).not.toContain('—');
  });
});

import { describe, expect, it } from 'vitest';
import { buildChecklist } from '../services/petparent.home.logic.js';
const base = {
  hasAgreement: true,
  paymentSucceeded: false,
  cardSaved: true,
  approved: true,
  paymentTestMode: false,
  pets: [],
};
describe('truthful home payment checklist', () => {
  it('names a saved card without claiming payment', () =>
    expect(buildChecklist(base)[1]).toMatchObject({ label: 'Card saved', status: 'done' }));
  it('keeps an unapproved request outstanding', () =>
    expect(buildChecklist({ ...base, approved: false })[1]).toMatchObject({
      label: 'Card saved · awaiting approval',
      status: 'outstanding',
    }));
  it('marks a real captured payment paid', () =>
    expect(buildChecklist({ ...base, paymentSucceeded: true })[1]).toMatchObject({
      label: 'Paid',
      status: 'done',
    }));
  it('never presents a fake payment as paid, but lets a test card finish the task', () =>
    expect(
      buildChecklist({ ...base, paymentSucceeded: true, paymentTestMode: true })[1],
    ).toMatchObject({ label: 'Test card saved (no real payment)', status: 'done' }));
  it('keeps a test card on a request awaiting approval outstanding, and says it is a test', () =>
    expect(buildChecklist({ ...base, approved: false, paymentTestMode: true })[1]).toMatchObject({
      label: 'Test card saved · awaiting approval (no real payment)',
      status: 'outstanding',
    }));
  it('asks for a card when none is saved, test mode or not', () =>
    expect(buildChecklist({ ...base, cardSaved: false, paymentTestMode: true })[1]).toMatchObject({
      label: 'Card not saved',
      status: 'outstanding',
      tappable: true,
    }));
});

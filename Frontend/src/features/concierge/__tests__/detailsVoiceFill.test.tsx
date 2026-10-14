import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { DetailsVoiceFill } from '../components/checkout/DetailsVoiceFill';
import { CONCIERGE_COPY } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeDetailsDraft } from '../types';
import { applyDetailsDraft } from '../utils/applyDetailsDraft';
import type { DetailsDraft } from '../utils/validateDetails';

vi.mock('../api/conciergeApi', () => ({ conciergeApi: { readDetails: vi.fn() } }));

const said: ConciergeDetailsDraft = {
  firstName: 'Nina',
  lastName: 'Park',
  phone: '021 555 0142',
  address: null,
  emergencyContactNumber: null,
  pets: [{ name: 'Biscuit', breed: 'Golden Retriever' }],
  careNotes: 'Two cups of kibble, twice a day',
};

const emptyDraft = (): DetailsDraft => ({
  contact: { email: '', password: '', firstName: '', lastName: 'Typed', address: '', phone: '' },
  pets: [{ existingPetId: null, name: '', breed: '' }],
  dropOffTime: '09:00',
  pickUpTime: '17:00',
  careNotes: '',
  termsAccepted: false,
  vetConsent: false,
});

describe('filling the details from what the guest said', () => {
  it('fills only empty fields and never the email or password', () => {
    const next = applyDetailsDraft(emptyDraft(), said, true);

    expect(next.contact).toMatchObject({
      firstName: 'Nina',
      // Typed by the guest: never replaced.
      lastName: 'Typed',
      phone: '021 555 0142',
      email: '',
      password: '',
    });
    expect(next.pets[0]).toMatchObject({ name: 'Biscuit', breed: 'Golden Retriever' });
    expect(next.careNotes).toBe('Two cups of kibble, twice a day');
  });

  it('leaves a signed-in parent’s contact and a saved pet alone', () => {
    const draft = emptyDraft();
    draft.pets = [{ existingPetId: 'saved-pet', name: '', breed: '' }];

    const next = applyDetailsDraft(draft, said, false);

    expect(next.contact.firstName).toBe('');
    expect(next.pets[0]).toEqual({ existingPetId: 'saved-pet', name: '', breed: '' });
  });
});

describe('the say-it-once box', () => {
  beforeEach(() => {
    useConciergeStore.getState().setLocale('en');
    vi.mocked(conciergeApi.readDetails).mockReset();
  });

  it('shows what it understood and fills the form only on "Use these details"', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    vi.mocked(conciergeApi.readDetails).mockResolvedValue({ draft: said });
    render(<DetailsVoiceFill copy={CONCIERGE_COPY.en} onUse={onUse} />);

    await user.type(screen.getByLabelText('About you and your pet'), 'I am Nina Park');
    await user.click(screen.getByRole('button', { name: 'Fill the form' }));

    expect(await screen.findByText('We understood')).toBeInTheDocument();
    expect(screen.getByText('Biscuit, Golden Retriever')).toBeInTheDocument();
    expect(onUse).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use these details' }));
    expect(onUse).toHaveBeenCalledWith(said);
  });

  it('says to fill the form by hand when reading fails', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.readDetails).mockRejectedValue(new Error('down'));
    render(<DetailsVoiceFill copy={CONCIERGE_COPY.en} onUse={vi.fn()} />);

    await user.type(screen.getByLabelText('About you and your pet'), 'My dog Biscuit');
    await user.click(screen.getByRole('button', { name: 'Fill the form' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not read that just now. Please fill in the form.',
    );
  });
});

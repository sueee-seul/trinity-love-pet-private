import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PetProfilePage } from '../pages/PetProfilePage';
import { resetProfileState } from '../repository';
import { deletePetOnServer, fetchParentProfile } from '../parentProfileApi';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { clearParentWrittenText } from '../../i18n/parentWrittenText';

const PET_ID = '00000000-0000-4000-8000-000000000401';

// The profile store is PostgreSQL-only, so the page renders what this stubbed call returns.
vi.mock('../parentProfileApi', () => {
  const owner = {
    id: '00000000-0000-4000-8000-000000000101',
    fullName: 'Ava Mitchell',
    email: 'parent@example.test',
    phone: '',
    avatarUrl: null,
    address: '',
    dateOfBirth: null,
    emergencyContactNumber: '',
  };
  return {
    // The server answers a delete with the profile that is left.
    deletePetOnServer: vi.fn().mockResolvedValue({ owner, pets: [] }),
    fetchParentProfile: vi.fn().mockResolvedValue({
      owner,
      pets: [
        {
          id: '00000000-0000-4000-8000-000000000401',
          ownerId: '00000000-0000-4000-8000-000000000101',
          name: 'Luna Belle',
          species: 'DOG',
          breed: null,
          photoUrl: null,
          sex: 'female',
          desexed: true,
          allergies: ['Chicken'],
          medications: [],
          stays: [
            {
              id: 'stay-1',
              petId: '00000000-0000-4000-8000-000000000401',
              facilityId: 'facility-1',
              type: 'BOARDING',
              status: 'staying_now',
              startAt: '2026-09-20T09:00:00.000Z',
              endAt: '2026-09-30T09:00:00.000Z',
              facility: { id: 'facility-1', name: 'Wagstay Ponsonby', suburb: 'Ponsonby' },
            },
            {
              id: 'stay-2',
              petId: '00000000-0000-4000-8000-000000000401',
              facilityId: 'facility-2',
              type: 'BOARDING',
              status: 'refused',
              startAt: '2026-11-02T09:00:00.000Z',
              endAt: '2026-11-05T09:00:00.000Z',
              facility: { id: 'facility-2', name: 'Wagstay Grey Lynn', suburb: 'Grey Lynn' },
            },
          ],
        },
      ],
    }),
  };
});

function LocationProbe(): React.ReactElement {
  const location = useLocation();
  return <p>{`Now at ${location.pathname}${location.search}`}</p>;
}

const renderPetPage = (petId = PET_ID): void => {
  render(
    <MemoryRouter initialEntries={[`/parent/pets/${petId}`]}>
      <Routes>
        <Route path="/parent/pets/:id" element={<PetProfilePage />} />
        <Route path="/parent/profile" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('PetProfilePage', () => {
  beforeEach(() => {
    resetProfileState();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
  });

  it('loads the profile itself and titles the page with the pet name', async () => {
    renderPetPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Luna Belle' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // No breed on file, so the species is named in words, not as the API enum.
    expect(screen.getByText(/^Dog · Female · /)).toBeInTheDocument();
  });

  it('links back to the pets tab', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    expect(screen.getByRole('link', { name: /My pets/ })).toHaveAttribute(
      'href',
      '/parent/profile?tab=pets',
    );
  });

  it('books a stay with this pet already chosen', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    expect(screen.getByRole('link', { name: 'Book a stay' })).toHaveAttribute(
      'href',
      `/parent/booking?pet=${PET_ID}`,
    );
  });

  it('gives every card the same kind of heading, in sentence case', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Details',
      'Vet and emergency',
      'Diet and behaviour',
      'Medications',
      'Stay history',
    ]);
  });

  it('shows stay statuses in words and links each stay to the stays list', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    const stayLink = screen.getByRole('link', { name: /Wagstay Ponsonby/ });
    expect(stayLink).toHaveAttribute('href', '/parent/stays');
    // The same words My stays uses, since each row links there.
    expect(within(stayLink).getByText('Staying now')).toBeInTheDocument();
    const refusedLink = screen.getByRole('link', { name: /Wagstay Grey Lynn/ });
    expect(within(refusedLink).getByText('Not accepted')).toBeInTheDocument();
    expect(screen.queryByText(/staying_now|refused/)).not.toBeInTheDocument();
  });

  it('draws initials, not an emoji, when the pet has no photo', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    expect(screen.getByText('LB')).toBeInTheDocument();
    expect(screen.queryByText('🐕')).not.toBeInTheDocument();
  });

  it('opens the edit form in a dialog that closes from its labelled close button', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit pet' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Luna Belle' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog', { name: 'Edit Luna Belle' })).not.toBeInTheDocument();
  });

  it('closes the dialog with Escape', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit pet' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Edit Luna Belle' })).not.toBeInTheDocument();
  });

  it('leaves the dialog open when a picker inside it has already handled Escape', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Edit pet' }));
    // The date picker marks its own Escape as handled so only the picker closes.
    const handledEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handledEscape.preventDefault();
    window.dispatchEvent(handledEscape);

    expect(screen.getByRole('dialog', { name: 'Edit Luna Belle' })).toBeInTheDocument();
  });

  it('returns to the pets tab after the pet is deleted', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete pet' }));

    expect(await screen.findByText('Now at /parent/profile?tab=pets')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('warns that the profile goes but the stays, payments and feedback stay on record', async () => {
    vi.mocked(deletePetOnServer).mockClear();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete pet' }));

    const warning = confirmSpy.mock.calls[0]?.[0] ?? '';
    expect(warning).toContain(
      "Luna Belle's profile, photo, medicines and care notes will be deleted",
    );
    expect(warning).toContain('cannot be recovered');
    expect(warning).toContain('Past stays, payments and feedback stay on record');
    expect(deletePetOnServer).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('stays on the page and says why when a stay is still open', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deletePetOnServer).mockRejectedValueOnce(
      new Error('This pet has a stay that is coming up, under way or not yet paid.'),
    );
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete pet' }));

    expect(
      await screen.findByText('This pet has a stay that is coming up, under way or not yet paid.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Luna Belle' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('says the pet was not found only once the profile has loaded', async () => {
    renderPetPage('00000000-0000-4000-8000-000000000999');

    expect(screen.getByRole('status')).toHaveTextContent('Loading your pet…');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pet not found' })).toBeVisible();
  });

  it('says the pet could not be loaded, not that a save failed, and loads it on retry', async () => {
    // The store logs the failed load; keep the test output clean.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchParentProfile).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPetPage();

    expect(await screen.findByText('We could not load your pet')).toBeVisible();
    expect(screen.getByText(/We could not reach Wagstay/)).toBeInTheDocument();
    expect(screen.queryByText('Not saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading your pet…')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Luna Belle' })).toBeVisible();
    consoleSpy.mockRestore();
  });

  it('lets a typed allergy wrap inside its badge but keeps a stay status on one line', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    // A long allergy name must stay inside a phone-width card instead of pushing past its edge.
    const allergy = screen.getByText('Chicken allergy');
    expect(allergy).toHaveClass('whitespace-normal', 'max-w-full');
    expect(allergy).not.toHaveClass('whitespace-nowrap');
    expect(screen.getByText('Staying now')).toHaveClass('whitespace-nowrap');
  });

  it('gives the All stays link a full-size touch target', async () => {
    renderPetPage();
    await screen.findByRole('heading', { level: 1, name: 'Luna Belle' });

    expect(screen.getByRole('link', { name: 'All stays' })).toHaveClass('min-h-11');
  });
});

// An English page shows no Chinese: notes the parent wrote in Chinese are shown in English.
describe('PetProfilePage, notes the parent wrote in Chinese', () => {
  beforeEach(async () => {
    resetProfileState();
    clearParentWrittenText();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
    const profile = await vi.mocked(fetchParentProfile)();
    const [pet] = profile.pets;
    vi.mocked(fetchParentProfile).mockResolvedValueOnce({
      ...profile,
      pets: pet ? [{ ...pet, allergies: ['鸡肉'], behaviourNotes: '怕打雷' }] : [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ translations: ['Scared of thunder', 'Chicken'] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the allergy and the behaviour note in English', async () => {
    renderPetPage();

    expect(await screen.findByText('Scared of thunder')).toBeInTheDocument();
    expect(screen.getByText('Chicken allergy')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[㐀-鿿]/);
  });
});

describe('PetProfilePage in Chinese', () => {
  beforeEach(() => {
    resetProfileState();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
    useConciergeStore.getState().setLocale('zh');
    expect(englishWordsIn(document.body, [])).toEqual([]);
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('shows the pet in Chinese and switches back to English', async () => {
    renderPetPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Luna Belle' })).toBeVisible();
    expect(screen.getByText(/^狗狗 · 母 · /)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '预订住宿' })).toBeInTheDocument();
    expect(screen.getByText('过敏：Chicken')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '住宿记录' })).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByText(/^Dog · Female · /)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Stay history' })).toBeInTheDocument();
  });
});

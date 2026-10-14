import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactsCard } from '../components/ContactsCard';
import { addContact, fetchContacts, removeContact, updateContact } from '../contactsApi';
import { ParentProfileApiError } from '../parentProfileApi';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { hanCharactersIn } from '../../../../shared/i18n/testing/hanCharactersIn';
import type { AccountContact } from '../../types/contacts';

vi.mock('../contactsApi', () => ({
  fetchContacts: vi.fn(),
  addContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
}));

const INFORMED = 'I have told this person that Wagstay holds their name and number';
const PRIVACY =
  'We keep this only to reach them if we cannot reach you, and we never contact them for marketing.';

const ava: AccountContact = {
  id: 'c-ava',
  role: 'emergency',
  name: 'Ava Mitchell',
  phone: '021 999 0000',
  relationship: 'Sister',
  informedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const ben: AccountContact = {
  id: 'c-ben',
  role: 'emergency',
  name: 'Ben Mitchell',
  phone: '021 888 0000',
  relationship: 'Brother',
  informedAt: null,
  createdAt: '2026-10-02T00:00:00.000Z',
};

beforeEach(() => {
  vi.mocked(fetchContacts).mockResolvedValue([ava, ben]);
});

afterEach(() => {
  vi.clearAllMocks();
  useConciergeStore.getState().setLocale('en');
});

describe('ContactsCard', () => {
  it('lists the emergency contacts, each with their tick box, and never mentions collecting', async () => {
    render(<ContactsCard />);

    expect(await screen.findByRole('heading', { name: 'Emergency contacts' })).toBeInTheDocument();
    expect(screen.getByText('Ava Mitchell')).toBeInTheDocument();
    expect(screen.getByText('Sister · 021 999 0000')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Ava Mitchell/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Ben Mitchell/ })).not.toBeChecked();
    expect(screen.getByText(PRIVACY)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/collect|pick-up|pick up/i);
    expect(hanCharactersIn(document.body)).toEqual([]);
    expect(fetchContacts).toHaveBeenCalledTimes(1);
  });

  it('adds an emergency contact with the body the server expects, then clears the form', async () => {
    const user = userEvent.setup();
    vi.mocked(addContact).mockResolvedValue({
      id: 'c-chloe',
      role: 'emergency',
      name: 'Chloe Park',
      phone: '021 555 0000',
      relationship: 'Neighbour',
      informedAt: '2026-10-05T00:00:00.000Z',
      createdAt: '2026-10-05T00:00:00.000Z',
    });
    render(<ContactsCard />);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Chloe Park');
    await user.type(screen.getByRole('textbox', { name: 'Phone' }), '021 555 0000');
    await user.type(screen.getByRole('textbox', { name: 'Relationship' }), 'Neighbour');
    // The form's own box: the row boxes carry the person's name in their label.
    await user.click(screen.getByRole('checkbox', { name: INFORMED }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(addContact).toHaveBeenCalledWith({
      role: 'emergency',
      name: 'Chloe Park',
      phone: '021 555 0000',
      relationship: 'Neighbour',
      informed: true,
    });
    expect(await screen.findByText('Chloe Park')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: INFORMED })).not.toBeChecked();
  });

  it('records that the person was told, sending only that field', async () => {
    const user = userEvent.setup();
    vi.mocked(updateContact).mockResolvedValue({
      ...ben,
      informedAt: '2026-10-05T01:00:00.000Z',
    });
    render(<ContactsCard />);
    const box = await screen.findByRole('checkbox', { name: /Ben Mitchell/ });

    await user.click(box);

    expect(updateContact).toHaveBeenCalledWith('c-ben', { informed: true });
    await waitFor(() => expect(box).toBeChecked());
  });

  it('refuses an emergency contact without a phone before asking the server', async () => {
    const user = userEvent.setup();
    render(<ContactsCard />);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Dee Park');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An emergency contact needs a phone number.',
    );
    expect(addContact).not.toHaveBeenCalled();
  });

  it('removes a person and shows the server’s words when a write is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(removeContact).mockResolvedValue(undefined);
    vi.mocked(addContact).mockRejectedValue(
      new ParentProfileApiError('You can name up to five people.', 400),
    );
    render(<ContactsCard />);

    await user.click(await screen.findByRole('button', { name: 'Remove Ben Mitchell' }));
    expect(removeContact).toHaveBeenCalledWith('c-ben');
    await waitFor(() => expect(screen.queryByText('Ben Mitchell')).not.toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Dee Park');
    await user.type(screen.getByRole('textbox', { name: 'Phone' }), '021 777 0000');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You can name up to five people.');
  });

  it('writes the card in Chinese with no English left but the names the parent typed', async () => {
    useConciergeStore.getState().setLocale('zh');
    render(<ContactsCard />);

    expect(await screen.findByRole('heading', { name: '紧急联系人' })).toBeInTheDocument();
    expect(
      screen.getByText('我们只在联系不上你时用这些信息联系他们，不会用于营销。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加' })).toBeInTheDocument();
    expect(englishWordsIn(document.body, ['Ava', 'Ben', 'Mitchell', 'Sister', 'Brother'])).toEqual(
      [],
    );
  });
});

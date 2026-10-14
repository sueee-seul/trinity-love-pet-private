import type { ReactElement } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerForm, PetForm } from '../components/ProfileForms';
import type { PetIntakeDraft } from '../petIntakeApi';
import type { OwnerProfile, OwnerProfileEditInput, PetFormInput } from '../types';
import { chooseDate, getCalendarDayButton } from '../../../../shared/components/ui/date/testing';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';

// The draft the stubbed assistant hands the form. Hoisted, so the mock factory below can read it.
const intake = vi.hoisted(() => ({ draft: {} as PetIntakeDraft }));

// The real assistant calls the server; the form only needs the draft it hands over.
vi.mock('../components/PetIntakeAssistant', () => ({
  PetIntakeAssistant: ({ onDraft }: { onDraft: (draft: PetIntakeDraft) => void }): ReactElement => (
    <button type="button" onClick={() => onDraft(intake.draft)}>
      Apply draft
    </button>
  ),
}));

const OWNER: OwnerProfile = {
  id: 'owner-1',
  fullName: 'Ava Mitchell',
  email: 'parent@example.test',
  phone: '021 000 1111',
  avatarUrl: null,
  address: '12 Queen Street, Auckland',
  dateOfBirth: '1992-04-18',
  emergencyContactNumber: '021 999 0000',
};

afterEach(() => {
  intake.draft = {};
  vi.useRealTimers();
});

describe('OwnerForm date of birth', () => {
  it('shows the stored date in English and saves a picked date as YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: OwnerProfileEditInput) => void>();
    render(<OwnerForm owner={OWNER} onSave={onSave} onCancel={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Date of birth' });
    expect(trigger).toHaveTextContent('Sat 18 Apr 1992');

    await chooseDate(user, trigger, '1990-01-01');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: '1990-01-01' }));
  });

  it('saves null when there is no date of birth', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: OwnerProfileEditInput) => void>();
    render(
      <OwnerForm owner={{ ...OWNER, dateOfBirth: null }} onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: null }));
  });

  it('does not offer a date of birth after today', async () => {
    // Only Date is faked, so user-event's own timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 12));
    const user = userEvent.setup();
    render(
      <OwnerForm owner={{ ...OWNER, dateOfBirth: null }} onSave={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Date of birth' }));

    expect(getCalendarDayButton('2026-09-28')).toBeEnabled();
    expect(getCalendarDayButton('2026-09-29')).toBeDisabled();
  });
});

describe('OwnerForm optional contact details', () => {
  it('saves a parent who has no address or emergency contact, as the booking form leaves them', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: OwnerProfileEditInput) => void>();
    render(
      <OwnerForm
        owner={{ ...OWNER, address: '', emergencyContactNumber: '' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ address: '', emergencyContactNumber: '' }),
    );
  });

  it('still refuses an emergency number that cannot be dialled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: OwnerProfileEditInput) => void>();
    render(
      <OwnerForm
        owner={{ ...OWNER, emergencyContactNumber: '12' }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('PetForm birth date', () => {
  it('saves a picked birth date as YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: PetFormInput) => void>();
    render(<PetForm onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: 'Pet name' }), 'Mochi');
    await chooseDate(user, screen.getByRole('button', { name: 'Birth date' }), '2021-08-24');
    await user.click(screen.getByRole('button', { name: 'Add pet' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ birthDate: '2021-08-24' }));
  });

  it('fills the birth date from an assistant draft', async () => {
    const user = userEvent.setup();
    intake.draft = { birthDate: '2021-08-24' };
    render(<PetForm onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Apply draft' }));

    expect(screen.getByRole('button', { name: 'Birth date' })).toHaveTextContent('Tue 24 Aug 2021');
  });

  it('ignores a draft birth date that is not a real day', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: PetFormInput) => void>();
    intake.draft = { name: 'Mochi', birthDate: 'about 2021' };
    render(<PetForm onSave={onSave} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Apply draft' }));
    await user.click(screen.getByRole('button', { name: 'Add pet' }));

    expect(screen.getByRole('button', { name: 'Birth date' })).toHaveTextContent('Choose a date');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ birthDate: null }));
  });
});

// Privacy Act IPP 3A: the person a parent tells us about should know we hold their details, so the
// notice sits by each field that collects them, not only on the Get ready list.
describe('the notice for a contact the parent adds', () => {
  it('describes the owner emergency contact number and still saves it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: OwnerProfileEditInput) => void>();
    render(<OwnerForm owner={OWNER} onSave={onSave} onCancel={vi.fn()} />);

    const field = screen.getByRole('textbox', { name: 'Emergency contact number (optional)' });
    expect(field).toHaveAccessibleDescription(
      'This is optional. Please tell this person Wagstay keeps their number to contact them in an emergency with your pet. They can ask our team to access or correct their details.',
    );

    await user.clear(field);
    await user.type(field, '021 555 0101');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ emergencyContactNumber: '021 555 0101' }),
    );
  });

  it("describes the pet's vet and emergency contact fields and still saves them", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: PetFormInput) => void>();
    render(<PetForm onSave={onSave} onCancel={vi.fn()} />);

    const notice =
      'If you add a person here, please tell them that we keep their name and number to contact them about your pet.';
    for (const name of ['Vet name', 'Vet phone', 'Emergency contact']) {
      expect(screen.getByRole('textbox', { name })).toHaveAccessibleDescription(notice);
    }

    await user.type(screen.getByRole('textbox', { name: 'Pet name' }), 'Mochi');
    await user.type(screen.getByRole('textbox', { name: 'Vet name' }), 'Dr Aroha Smith');
    await user.type(screen.getByRole('textbox', { name: 'Vet phone' }), '09 555 0102');
    await user.type(
      screen.getByRole('textbox', { name: 'Emergency contact' }),
      'Tama 021 555 0103',
    );
    await user.click(screen.getByRole('button', { name: 'Add pet' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        vetName: 'Dr Aroha Smith',
        vetPhone: '09 555 0102',
        emergencyContact: 'Tama 021 555 0103',
      }),
    );
  });
});

describe('the profile forms in Chinese', () => {
  beforeEach(() => {
    useConciergeStore.getState().setLocale('zh');
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('labels the pet form in Chinese, saves the stored values, and switches back to English', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(value: PetFormInput) => void>();
    render(<PetForm onSave={onSave} onCancel={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: '兽医姓名' })).toHaveAccessibleDescription(
      '如果在这里填写了别人的信息，请告知对方：我们会保存他们的姓名和电话，用于就你的宠物联系他们。',
    );
    await user.type(screen.getByRole('textbox', { name: '宠物名字' }), 'Mochi');
    // The option reads 猫咪, but the value saved is still the enum the API stores.
    await user.selectOptions(screen.getByRole('combobox', { name: '种类' }), '猫咪');
    await user.selectOptions(screen.getByRole('combobox', { name: '性别' }), '母');
    await user.click(screen.getByRole('button', { name: '添加宠物' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Mochi', species: 'CAT', sex: 'female' }),
    );

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('textbox', { name: 'Pet name' })).toHaveValue('Mochi');
    expect(screen.getByRole('button', { name: 'Add pet' })).toBeInTheDocument();
  });

  it('words the phone problems in Chinese', () => {
    render(
      <OwnerForm
        owner={{ ...OWNER, phone: '', emergencyContactNumber: '12' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual([
      '请填写电话号码。',
      '请填写有效的电话号码，比如 +64 21 123 4567 或 021 123 4567',
    ]);
    expect(screen.getByRole('button', { name: '保存修改' })).toBeDisabled();
  });
});

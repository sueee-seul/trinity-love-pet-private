// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PetProfileDetailsPanel } from '../PetProfileDetailsPanel';
import type { Pet } from '../../../types/pet';

const pet: Pet = {
  id: 'p1',
  name: 'Sherlock',
  status: 'approved',
  checkInDate: '15/08/2026',
  checkOutDate: '20/08/2026',
  type: 'Dog',
  age: 4,
  gender: 'Male',
  ownerName: 'Jennifer Andrews',
  breed: 'Labrador Retriever',
  weight: 24.5,
  microchipNumber: '982000123456789',
};

describe('PetProfileDetailsPanel', () => {
  it('renders read-only values by default with an Edit info button', () => {
    render(<PetProfileDetailsPanel pet={pet} onSave={vi.fn()} />);

    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('4 yrs old')).toBeInTheDocument();
    expect(screen.getByText('Jennifer Andrews')).toBeInTheDocument();
    expect(screen.getByText('Labrador Retriever')).toBeInTheDocument();
    expect(screen.getByText('24.5 kg')).toBeInTheDocument();
    expect(screen.getByText('982000123456789')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit info' })).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();
  });

  it('switches to editable form controls, pre-filled with current values, when Edit info is clicked', async () => {
    const user = userEvent.setup();
    render(<PetProfileDetailsPanel pet={pet} onSave={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Edit info' }));

    expect(screen.getByLabelText('Type')).toHaveValue('Dog');
    expect(screen.getByLabelText('Gender')).toHaveValue('Male');
    expect(screen.getByLabelText('Age')).toHaveValue(4);
    expect(screen.getByLabelText('Breed')).toHaveValue('Labrador Retriever');
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(24.5);
    expect(screen.getByLabelText('Microchip')).toHaveValue('982000123456789');
    expect(screen.getByLabelText('Owner')).toHaveValue('Jennifer Andrews');
  });

  it('saves edited values and returns to read-only view on success', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PetProfileDetailsPanel pet={pet} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit info' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'Cat');
    await user.clear(screen.getByLabelText('Owner'));
    await user.type(screen.getByLabelText('Owner'), 'New Owner');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      type: 'Cat',
      gender: 'Male',
      age: 4,
      ownerName: 'New Owner',
      breed: 'Labrador Retriever',
      weight: 24.5,
      microchipNumber: '982000123456789',
    });
    expect(await screen.findByRole('button', { name: 'Edit info' })).toBeInTheDocument();
  });

  it('discards changes when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PetProfileDetailsPanel pet={pet} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit info' }));
    await user.clear(screen.getByLabelText('Owner'));
    await user.type(screen.getByLabelText('Owner'), 'Discarded Name');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Jennifer Andrews')).toBeInTheDocument();
    expect(screen.queryByText('Discarded Name')).not.toBeInTheDocument();
  });

  it('shows a validation error and does not save when age is not positive', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PetProfileDetailsPanel pet={pet} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit info' }));
    await user.clear(screen.getByLabelText('Age'));
    await user.type(screen.getByLabelText('Age'), '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Age must be a positive number.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows an error and stays in edit mode when the save request fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('network error'));
    render(<PetProfileDetailsPanel pet={pet} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit info' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save changes. Please try again.',
    );
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
  });
});

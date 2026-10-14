// @vitest-environment jsdom
import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PetTable } from '../PetTable';
import type { Pet } from '../../../types/pet';

const pets: Pet[] = [
  {
    id: 'p1',
    name: 'Sherlock',
    status: 'approved',
    checkInDate: '15/08/2026',
    checkOutDate: '20/08/2026',
    type: 'Dog',
    age: 4,
    gender: 'Male',
    ownerName: 'Jennifer Andrews',
  },
  {
    id: 'p2',
    name: 'Arctic Dog',
    status: 'staying_now',
    checkInDate: '10/08/2026',
    checkOutDate: null,
    type: 'Dog',
    age: 3,
    gender: 'Male',
    ownerName: 'Jason Lo',
  },
  {
    id: 'p3',
    name: 'Mittens',
    status: 'stay_ended',
    checkInDate: '12/07/2026',
    checkOutDate: '20/07/2026',
    type: 'Cat',
    age: 6,
    gender: 'Female',
    ownerName: 'Intake Checklist Parent',
  },
];

const renderTable = (overrides: Partial<ComponentProps<typeof PetTable>> = {}): RenderResult =>
  render(
    <PetTable
      pets={pets}
      loading={false}
      errorMessage={null}
      onViewPet={() => {}}
      {...overrides}
    />,
  );

const getNameColumn = (): (string | null)[] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('PetTable sorting', () => {
  it('defaults to sorting by name ascending (A to Z) with no interaction required', () => {
    renderTable();

    expect(getNameColumn()).toEqual(['Arctic Dog', 'Mittens', 'Sherlock']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('toggles the active column to descending, then back to ascending', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(getNameColumn()).toEqual(['Sherlock', 'Mittens', 'Arctic Dog']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(getNameColumn()).toEqual(['Arctic Dog', 'Mittens', 'Sherlock']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('renders a status column and sorts the pets in our care first', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Status' }));

    // Staying now, then confirmed and arriving, then stays that ended.
    expect(getNameColumn()).toEqual(['Arctic Dog', 'Sherlock', 'Mittens']);
  });

  it('sorts numeric columns like Age by value, not lexicographically', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Age' }));

    const ageColumn = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[5].textContent);
    expect(ageColumn).toEqual(['3', '4', '6']);
  });

  it('sorts Check-in by chronological DD/MM/YYYY date, not lexicographic string order', async () => {
    const user = userEvent.setup();
    renderTable();

    // "10/08/2026" < "12/07/2026" < "15/08/2026" lexicographically, but chronologically
    // 12 Jul is earliest, then 10 Aug, then 15 Aug. This proves the day and month aren't swapped.
    await user.click(screen.getByRole('button', { name: 'Check-in' }));
    expect(getNameColumn()).toEqual(['Mittens', 'Arctic Dog', 'Sherlock']);
  });

  it('sinks pets with no check-out date to the bottom regardless of direction', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Check-out' }));
    expect(getNameColumn()[2]).toBe('Arctic Dog');

    await user.click(screen.getByRole('button', { name: 'Check-out' }));
    expect(getNameColumn()[2]).toBe('Arctic Dog');
  });

  it('disables sorting while loading', () => {
    renderTable({ loading: true, pets: [] });
    expect(screen.getByRole('button', { name: 'Name' })).toBeDisabled();
  });
});

describe('PetTable navigation', () => {
  it('calls onViewPet with the pet id when its name is clicked', async () => {
    const user = userEvent.setup();
    const onViewPet = vi.fn();
    renderTable({ onViewPet });

    await user.click(screen.getByRole('button', { name: 'Sherlock' }));

    expect(onViewPet).toHaveBeenCalledWith('p1');
    expect(onViewPet).toHaveBeenCalledTimes(1);
  });
});

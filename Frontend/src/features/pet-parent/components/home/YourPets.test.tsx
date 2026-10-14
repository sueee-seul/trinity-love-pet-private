import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import type { HomePet } from '../../types/home';
import { YourPets } from './YourPets';

const max: HomePet = { id: 'pet-max', name: 'Max', species: 'dog', breed: 'Labrador', ageYears: 4 };
const luna: HomePet = { id: 'pet-luna', name: 'Luna', species: 'cat', ageYears: 2 };

describe('YourPets', () => {
  it('gives each pet a "Book a stay" link that opens the booking page with that pet chosen', () => {
    render(
      <MemoryRouter>
        <YourPets pets={[max, luna]} />
      </MemoryRouter>,
    );

    // A phone tile and a desktop row per pet, each with its own link.
    const forMax = screen.getAllByRole('link', { name: 'Book a stay for Max' });
    expect(forMax).toHaveLength(2);
    forMax.forEach((link) => expect(link).toHaveAttribute('href', '/parent/booking?pet=pet-max'));
    screen
      .getAllByRole('link', { name: 'Book a stay for Luna' })
      .forEach((link) => expect(link).toHaveAttribute('href', '/parent/booking?pet=pet-luna'));
  });

  it('keeps the pet page link and the booking link apart, never one inside the other', () => {
    render(
      <MemoryRouter>
        <YourPets pets={[max]} />
      </MemoryRouter>,
    );

    screen.getAllByRole('link', { name: /Labrador · 4\syrs/ }).forEach((petLink) => {
      expect(petLink).toHaveAttribute('href', '/parent/pets/pet-max');
      expect(petLink.querySelector('a')).toBeNull();
    });
  });

  it('keeps a long breed on one line in the side list, with the full text in its title', () => {
    const pepper: HomePet = {
      id: 'pet-pepper',
      name: 'Pepper',
      species: 'cat',
      breed: 'Domestic Shorthair',
      ageYears: 4,
    };
    render(
      <MemoryRouter>
        <YourPets pets={[pepper]} />
      </MemoryRouter>,
    );

    const rowMeta = screen.getByTitle('Domestic Shorthair · 4 yrs');
    expect(rowMeta).toHaveClass('truncate');
    // The phone card puts the breed and the age on lines of their own, with no separator.
    expect(screen.getByText('Domestic Shorthair')).toBeInTheDocument();
    expect(screen.getByText('4 yrs')).toBeInTheDocument();
  });

  describe('in Chinese', () => {
    afterEach(() => {
      act(() => useConciergeStore.getState().setLocale('en'));
    });

    it('names the section, the links and the pet details in Chinese, then English again', () => {
      useConciergeStore.getState().setLocale('zh');
      render(
        <MemoryRouter>
          <YourPets pets={[max, luna]} />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: '你的宠物' })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: '预订住宿（Max）' })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: '添加宠物' })).toHaveLength(2);
      expect(screen.getAllByText('猫咪 · 2 岁').length).toBeGreaterThan(0);

      act(() => useConciergeStore.getState().setLocale('en'));

      expect(screen.getAllByRole('link', { name: 'Book a stay for Max' })).toHaveLength(2);
      expect(screen.getAllByText('Cat · 2 yrs').length).toBeGreaterThan(0);
    });
  });
});

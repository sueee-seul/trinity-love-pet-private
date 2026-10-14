// @vitest-environment jsdom
import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PetListPage } from '../PetListPage';
import type { Pet } from '../../types/pet';

const mockPets: Pet[] = [
  {
    id: 'p1',
    name: 'Sherlock',
    status: 'approved',
    type: 'Dog',
    age: 4,
    gender: 'Male',
    ownerName: 'Jennifer Andrews',
    checkInDate: '15/08/2026',
    checkOutDate: '20/08/2026',
  },
  {
    id: 'p2',
    name: 'Whiskers',
    status: 'staying_now',
    type: 'Cat',
    age: 2,
    gender: 'Female',
    ownerName: 'Scott Patterson',
    checkInDate: '28/07/2026',
    checkOutDate: null,
  },
];

const renderPage = (): RenderResult => {
  return render(
    <MemoryRouter>
      <PetListPage />
    </MemoryRouter>,
  );
};

describe('PetListPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  const configureFetchMock = (petsResponse: Pet[] = mockPets): void => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve({ ok: true, json: async () => petsResponse });
    });
  };

  it('renders the table frame with column headers immediately, before data resolves', () => {
    configureFetchMock();

    renderPage();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Check-out' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Staff' })).not.toBeInTheDocument();
  });

  it('renders a row per pet with a placeholder for a null check-out date', async () => {
    configureFetchMock();

    renderPage();

    expect(await screen.findByText('Sherlock')).toBeInTheDocument();
    expect(screen.getByText('Whiskers')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('shows an empty state inside the table frame when there are no pets', async () => {
    configureFetchMock([]);

    renderPage();

    expect(await screen.findByText('No pets found.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('keeps the table frame and shows an error message when the pet list request fails', async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load pets. Please try again.',
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('filters the list by name as the user types in the search bar', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();
    await screen.findByText('Sherlock');

    await user.type(screen.getByRole('textbox', { name: 'Search pets' }), 'Sherlock');

    expect(screen.getByText('Sherlock')).toBeInTheDocument();
    expect(screen.queryByText('Whiskers')).not.toBeInTheDocument();
  });

  it('filters the list by owner name as the user types in the search bar', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();
    await screen.findByText('Sherlock');

    await user.type(screen.getByRole('textbox', { name: 'Search pets' }), 'Jennifer Andrews');

    expect(screen.getByText('Sherlock')).toBeInTheDocument();
    expect(screen.queryByText('Whiskers')).not.toBeInTheDocument();
  });

  it('shows a search-specific empty state when no pet matches the query', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();
    await screen.findByText('Sherlock');

    await user.type(screen.getByRole('textbox', { name: 'Search pets' }), 'no such pet');

    expect(await screen.findByText('No pets match your search.')).toBeInTheDocument();
    expect(screen.queryByText('No pets found.')).not.toBeInTheDocument();
  });

  it("navigates to that pet's dashboard when its name is clicked", async () => {
    const user = userEvent.setup();
    configureFetchMock();

    render(
      <MemoryRouter initialEntries={['/admin/pets']}>
        <Routes>
          <Route path="/admin/pets" element={<PetListPage />} />
          <Route path="/admin/pets/:id" element={<div>Pet dashboard for p1</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Sherlock' }));

    expect(await screen.findByText('Pet dashboard for p1')).toBeInTheDocument();
  });
});

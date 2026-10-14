// @vitest-environment jsdom
import { render, screen, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PetDashboardPage } from '../PetDashboardPage';
import type { PetDetail } from '../../types/pet';

const mockPet: PetDetail = {
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
  healthNotes: null,
  behaviourNotes: null,
  medications: [],
};

const mockStaffOptions = [{ id: 'u2', name: 'Bob Staff' }];

const renderPage = (path = '/admin/pets/p1'): RenderResult =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/pets" element={<div>Pet List</div>} />
        <Route path="/admin/pets/:id" element={<PetDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PetDashboardPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    // Clear call history only (not the implementation): TaskTimeline's fetch
    // calls are fire-and-forget and may still be in flight when a test ends,
    // so a stale-but-valid mock implementation is safer than resetting to
    // undefined, which would crash the still-pending .then() chain.
    fetchMock.mockClear();
  });

  const configureFetchMock = (petResponse: PetDetail | null = mockPet, status = 200): void => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/assignees')) {
        return Promise.resolve({ ok: true, json: async () => mockStaffOptions });
      }
      if (url.includes('/admin/pets/') && url.endsWith('/assignments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (petResponse === null) {
        return Promise.resolve({ ok: false, status, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => petResponse });
    });
  };

  it("renders the clicked pet's identity and assigned staff name", async () => {
    configureFetchMock();

    renderPage();

    expect(await screen.findByRole('heading', { name: /Sherlock/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Task Timeline' })).toBeInTheDocument();
    expect(screen.getByText(/Jennifer Andrews/)).toBeInTheDocument();
    expect(screen.getByText('Check-in: 15/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Check-out: 20/08/2026')).toBeInTheDocument();
  });

  it('shows a link back to the pet list', async () => {
    configureFetchMock();

    renderPage();

    expect(await screen.findByRole('heading', { name: /Sherlock/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Pet List/ })).toHaveAttribute(
      'href',
      '/admin/pets',
    );
  });

  it('names the pet by its stay, with the words its owner reads, and sends arrivals to the desk', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/assignees')) {
        return Promise.resolve({ ok: true, json: async () => mockStaffOptions });
      }
      if (url.includes('/admin/pets/') && url.endsWith('/assignments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ...mockPet, status: 'approved' }) });
    });

    renderPage();

    await screen.findByRole('heading', { name: /Sherlock/ });
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record arrival at the desk' })).toHaveAttribute(
      'href',
      '/admin/bookings',
    );
    // No switch of its own: a check-in recorded here used to stick to the pet across stays.
    expect(screen.queryByRole('button', { name: 'Check in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check out' })).not.toBeInTheDocument();
  });

  it('shows a stay under way without a desk link', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/assignees')) {
        return Promise.resolve({ ok: true, json: async () => mockStaffOptions });
      }
      if (url.includes('/admin/pets/') && url.endsWith('/assignments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...mockPet, status: 'staying_now' }),
      });
    });

    renderPage();

    await screen.findByRole('heading', { name: /Sherlock/ });
    expect(screen.getByText('Staying now')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Record arrival at the desk' }),
    ).not.toBeInTheDocument();
  });

  it('shows an error message with a way back when the pet cannot be loaded', async () => {
    configureFetchMock(null, 404);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load this pet. Please try again.',
    );
    expect(screen.getByRole('link', { name: /Back to Pet List/ })).toBeInTheDocument();
  });

  it('lets staff expand, edit, and save the pet profile details', async () => {
    const user = userEvent.setup();
    const updatedPet: PetDetail = { ...mockPet, ownerName: 'Updated Owner' };

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/assignees')) {
        return Promise.resolve({ ok: true, json: async () => mockStaffOptions });
      }
      if (url.includes('/admin/pets/') && url.endsWith('/assignments')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (init?.method === 'PATCH') {
        expect(url).toContain('/admin/pets/p1');
        expect(JSON.parse(String(init.body))).toEqual({
          type: 'Dog',
          gender: 'Male',
          age: 4,
          ownerName: 'Updated Owner',
          breed: 'Labrador Retriever',
          weight: 24.5,
          microchipNumber: '982000123456789',
        });
        return Promise.resolve({ ok: true, json: async () => updatedPet });
      }
      return Promise.resolve({ ok: true, json: async () => mockPet });
    });

    renderPage();

    await screen.findByRole('heading', { name: /Sherlock/ });
    await user.click(screen.getByRole('button', { name: 'Expand pet profile details' }));
    await user.click(screen.getByRole('button', { name: 'Edit info' }));
    await user.clear(screen.getByLabelText('Owner'));
    await user.type(screen.getByLabelText('Owner'), 'Updated Owner');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Edit info' })).toBeInTheDocument();
    // Owner name now shows updated both in the header summary and the profile details panel.
    expect(screen.getAllByText(/Updated Owner/).length).toBeGreaterThanOrEqual(2);
  });
});

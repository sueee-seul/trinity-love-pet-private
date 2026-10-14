import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyBookings } from '../../../api/bookingApi';
import { bookedStay } from '../../../components/stays/__tests__/stayFixtures';
import { StayQuickActions } from '../StayQuickActions';

vi.mock('../../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));

/** 11:00 on Sun 13 Dec 2026 in Auckland, while Biscuit is in. */
const NOW = new Date('2026-12-12T22:00:00Z');

const renderStrip = (): void => {
  render(
    <MemoryRouter>
      <StayQuickActions now={NOW} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StayQuickActions', () => {
  it('leads to the two in-stay dialogs on My stays while a pet is staying', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([
      bookedStay({ bookingPetId: 'bp-mochi', pet: { id: 'pet-mochi', name: 'Mochi' } }),
      bookedStay({ status: 'staying_now', checkInOutcome: 'checked_in' }),
    ]);
    renderStrip();

    const strip = await screen.findByRole('navigation', { name: 'Changes to the stay under way' });
    expect(strip).toHaveTextContent('Biscuit is staying with us now.');
    expect(screen.getByRole('link', { name: 'Extend the stay' })).toHaveAttribute(
      'href',
      '/parent/stays?open=extend&stay=bp-biscuit',
    );
    expect(screen.queryByRole('link', { name: 'Pick up early' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a walk or playtime' })).toHaveAttribute(
      'href',
      '/parent/stays?open=add-on&stay=bp-biscuit',
    );
  });

  it('asks the assistant in the chat when the page can send a message', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([
      bookedStay({ status: 'staying_now', checkInOutcome: 'checked_in' }),
    ]);
    const onAsk = vi.fn();
    render(
      <MemoryRouter>
        <StayQuickActions now={NOW} onAsk={onAsk} />
      </MemoryRouter>,
    );

    await screen.findByRole('navigation', { name: 'Changes to the stay under way' });
    screen.getByRole('button', { name: 'Extend the stay' }).click();
    screen.getByRole('button', { name: 'Add a walk or playtime' }).click();

    expect(onAsk.mock.calls).toEqual([
      ["Can I extend Biscuit's stay by one night?"],
      ['Can I add a walk for Biscuit?'],
    ]);
    expect(screen.getByRole('link', { name: 'Open My Stays' })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
  });

  it('shows nothing when no pet is staying', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([bookedStay()]);
    renderStrip();

    await waitFor(() => expect(fetchMyBookings).toHaveBeenCalled());
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

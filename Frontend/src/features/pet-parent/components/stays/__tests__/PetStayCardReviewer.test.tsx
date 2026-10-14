import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { PetStayCard } from '../PetStayCard';
import { bookedStay } from './stayFixtures';
import type { PetStay } from '../../../types/stays';

// The manager who decided is the parent's contact for the stay, so the card names them.

const renderCard = (stay: PetStay): void => {
  render(
    <MemoryRouter>
      <PetStayCard
        stay={stay}
        onViewCare={vi.fn()}
        onViewBookingDetails={vi.fn()}
        onCancel={vi.fn()}
        onChangeDates={vi.fn()}
      />
    </MemoryRouter>,
  );
};

afterEach(() => {
  act(() => useConciergeStore.getState().setLocale('en'));
});

describe('PetStayCard names the deciding manager', () => {
  it('says who confirmed the stay, in English and in Chinese', () => {
    renderCard(bookedStay({ reviewerName: 'Mere' }));
    expect(
      screen.getByText('Confirmed by Mere, our manager and your contact for this stay.'),
    ).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('zh'));
    expect(screen.getByText('由经理 Mere 确认，Mere 是这次住宿的负责人。')).toBeInTheDocument();
  });

  it('says who refused the request, with the reason', () => {
    renderCard(
      bookedStay({
        status: 'refused',
        reviewStatus: 'refused',
        refusalReason: 'We are full that week.',
        reviewerName: 'James',
        card: null,
      }),
    );

    expect(
      screen.getByText('James, our manager, said: We are full that week.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Confirmed by/)).not.toBeInTheDocument();
  });

  it('names nobody for a stay confirmed at checkout', () => {
    renderCard(bookedStay());

    expect(screen.queryByText(/Confirmed by/)).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BRAND_MARK_SRC } from '../../../shared/brand/BrandMark';
import { ConciergeHeader, ConciergeHelpNav } from '../components/ConciergeHeader';
import { CONCIERGE_COPY } from '../copy';

const renderHeader = (signedIn: boolean, onSignIn = vi.fn()): void => {
  render(
    <MemoryRouter initialEntries={['/book']}>
      <ConciergeHeader
        copy={CONCIERGE_COPY.en}
        signedIn={signedIn}
        onTalkToPerson={vi.fn()}
        onSignIn={onSignIn}
      />
    </MemoryRouter>,
  );
};

describe('ConciergeHeader on /book', () => {
  it('takes the Wagstay wordmark back to the landing page', () => {
    renderHeader(false);

    const wordmark = screen.getByRole('link', { name: 'Wagstay' });
    expect(wordmark).toHaveAttribute('href', '/');
    expect(wordmark.querySelector(`img[src="${BRAND_MARK_SRC}"]`)).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'My pet centre' })).not.toBeInTheDocument();
  });

  it('opens the sign-in dialog for a returning owner instead of leaving the plan', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    renderHeader(false, onSignIn);

    await user.click(screen.getByRole('button', { name: 'Booked with us before? Sign in' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('gives a signed-in pet parent the way to their pet centre instead of sign-in', () => {
    renderHeader(true);

    expect(screen.getByRole('link', { name: 'My pet centre' })).toHaveAttribute('href', '/parent');
    expect(
      screen.queryByRole('button', { name: 'Booked with us before? Sign in' }),
    ).not.toBeInTheDocument();
  });
});

describe('ConciergeHelpNav in the portal', () => {
  it('offers a person and the language switch, and leaves sign-in to the portal', () => {
    render(
      <MemoryRouter initialEntries={['/parent/booking']}>
        <ConciergeHelpNav
          copy={CONCIERGE_COPY.en}
          standalone={false}
          signedIn
          onTalkToPerson={vi.fn()}
          onSignIn={vi.fn()}
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Booking help' });
    expect(nav).toContainElement(screen.getByRole('button', { name: 'Talk to a person' }));
    // The language switch moved to the accessibility tools, so the nav carries none.
    expect(screen.queryByRole('button', { name: '中文' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My pet centre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Wagstay' })).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageHeader, PortalPage } from '../PortalPage';

describe('PortalPage', () => {
  it('holds the page at the chosen width', () => {
    const { container } = render(
      <PortalPage width="narrow">
        <p>Body</p>
      </PortalPage>,
    );
    expect(container.firstElementChild).toHaveClass('max-w-3xl');
  });
});

describe('PageHeader', () => {
  it('draws one page title in the logo font with its lead and a way back', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="My stays"
          lead="Your pets' stays with us."
          back={{ to: '/parent', label: 'Home' }}
        />
      </MemoryRouter>,
    );
    const title = screen.getByRole('heading', { level: 1, name: 'My stays' });
    expect(title).toHaveClass('font-agbalumo', 'text-display', 'font-normal');
    expect(screen.getByText("Your pets' stays with us.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/parent');
  });

  it('leaves out the lead and the back link when there are none', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Leave feedback" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});

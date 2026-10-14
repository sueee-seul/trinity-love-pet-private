// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoCarousel, type PhotoCarouselPhoto } from '../PhotoCarousel';

const photos: PhotoCarouselPhoto[] = [
  { src: 'https://example.test/first.jpg', alt: 'First photo' },
  { src: 'https://example.test/second.jpg', alt: 'Second photo' },
  { src: 'https://example.test/third.jpg', alt: 'Third photo' },
];

describe('PhotoCarousel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows one image without navigation controls when there is one photo', () => {
    render(<PhotoCarousel photos={[photos[0]]} ariaLabel="Review photos" onClose={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('navigates one large image at a time with arrows, dots, and keyboard controls', async () => {
    const user = userEvent.setup();

    render(<PhotoCarousel photos={photos} ariaLabel="Review photos" onClose={vi.fn()} />);

    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Go to photo/ })).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Next photo' }));

    expect(screen.getByRole('img', { name: 'Second photo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'First photo' })).not.toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('img', { name: 'Third photo' })).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to photo 1' }));
    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();
  });

  it('auto-advances when enabled', () => {
    vi.useFakeTimers();

    render(
      <PhotoCarousel photos={photos} ariaLabel="Photos of the day" onClose={vi.fn()} autoplay />,
    );

    expect(screen.getByRole('img', { name: 'First photo' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('img', { name: 'Second photo' })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DayPhotoCarousel } from '../DayPhotoCarousel';

const photos = [
  {
    src: 'https://example.test/first.jpg',
    alt: 'Play photo 1',
    entryTitle: 'Dog Yard Playtime',
    entryTime: '11:30 AM',
  },
  {
    src: 'https://example.test/second.jpg',
    alt: 'Play photo 2',
    entryTitle: 'Dog Yard Playtime',
    entryTime: '11:30 AM',
  },
];

describe('DayPhotoCarousel', () => {
  it('keeps the Live Care full-screen wrapper and carousel controls', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<DayPhotoCarousel photos={photos} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Photos of the day' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByRole('img', { name: 'Play photo 1' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next photo' }));

    expect(screen.getByRole('img', { name: 'Play photo 2' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close photos' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

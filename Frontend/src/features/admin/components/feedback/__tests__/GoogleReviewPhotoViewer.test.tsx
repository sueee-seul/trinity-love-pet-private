// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoogleReviewPhotoViewer } from '../GoogleReviewPhotoViewer';

describe('GoogleReviewPhotoViewer', () => {
  it('does not render an image trigger when the review has no photos', () => {
    render(<GoogleReviewPhotoViewer reviewId="review-1" reviewerName="Andrew" photoUrls={[]} />);

    expect(screen.queryByRole('button', { name: /view image/i })).not.toBeInTheDocument();
  });

  it('opens one large review photo and navigates through the carousel', async () => {
    const user = userEvent.setup();

    render(
      <GoogleReviewPhotoViewer
        reviewId="review-1"
        reviewerName="Andrew"
        photoUrls={[
          '/uploads/google-reviews/first.jpg',
          'https://example.test/second.jpg',
          'https://example.test/third.jpg',
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'View image for Andrew' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 80,
      right: 300,
      bottom: 120,
      left: 220,
      width: 80,
      height: 40,
      x: 220,
      y: 80,
      toJSON: () => ({}),
    });

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Review photos for Andrew' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveStyle({ top: '128px', left: '220px', visibility: 'visible' });
    expect(screen.getByAltText("Andrew's review photo 1")).toBeInTheDocument();
    expect(screen.queryByAltText("Andrew's review photo 2")).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next photo' }));

    expect(screen.getByAltText("Andrew's review photo 2")).toBeInTheDocument();
    expect(screen.queryByAltText("Andrew's review photo 1")).not.toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close review photos for Andrew' }));

    expect(
      screen.queryByRole('dialog', { name: 'Review photos for Andrew' }),
    ).not.toBeInTheDocument();
  });
});

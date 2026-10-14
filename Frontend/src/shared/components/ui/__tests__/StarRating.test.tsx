import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from '../StarRating';

describe('StarRating', () => {
  it('previews the hovered rating and restores the selected rating after leaving', () => {
    const { container } = render(<StarRating value={2} onChange={vi.fn()} />);
    const stars = container.querySelectorAll('svg');
    const ratingContainer = container.firstElementChild;

    expect(stars[1]).toHaveClass('text-rating-filled');
    expect(stars[2]).toHaveClass('text-rating-empty');

    fireEvent.mouseEnter(stars[3]);

    expect(stars[2]).toHaveClass('text-rating-filled');
    expect(stars[3]).toHaveClass('text-rating-filled');
    expect(stars[4]).toHaveClass('text-rating-empty');

    if (!ratingContainer) {
      throw new Error('Expected the StarRating container to be rendered');
    }
    fireEvent.mouseLeave(ratingContainer);

    expect(stars[1]).toHaveClass('text-rating-filled');
    expect(stars[2]).toHaveClass('text-rating-empty');
  });

  it('calls onChange when an interactive star is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<StarRating value={2} onChange={onChange} />);
    const stars = container.querySelectorAll('svg');

    fireEvent.click(stars[4]);

    expect(onChange).toHaveBeenCalledWith(5);
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AverageRatingCard } from '../AverageRatingCard';

describe('AverageRatingCard', () => {
  it('shows average rating and review count without summary content', () => {
    render(<AverageRatingCard rating={{ average: 4.3, reviewCount: 12 }} />);

    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('Based on 12 reviews')).toBeInTheDocument();
    expect(screen.queryByText(/summary/i)).not.toBeInTheDocument();
  });

  it('shows a placeholder when no rating exists', () => {
    render(<AverageRatingCard rating={{ average: null, reviewCount: 0 }} />);

    expect(screen.getByText('No rating yet')).toBeInTheDocument();
    expect(screen.getByText('Based on 0 reviews')).toBeInTheDocument();
  });
});

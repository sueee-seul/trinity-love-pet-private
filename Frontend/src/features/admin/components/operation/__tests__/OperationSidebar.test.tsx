// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperationSidebar } from '../OperationSidebar';

describe('OperationSidebar', () => {
  it('labels the feedback operation as Feedback Overview', () => {
    render(<OperationSidebar activeTab="feedback" onTabChange={vi.fn()} />);

    const operationNavigation = within(
      screen.getByRole('navigation', { name: 'Operation workspace sections' }),
    );

    expect(
      operationNavigation.getByRole('button', { name: 'Feedback Overview' }),
    ).toBeInTheDocument();
    expect(
      operationNavigation.queryByRole('button', { name: 'Feedback Dashboard' }),
    ).not.toBeInTheDocument();
  });
});

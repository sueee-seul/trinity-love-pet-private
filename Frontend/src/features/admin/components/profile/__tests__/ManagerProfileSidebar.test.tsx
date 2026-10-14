import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ManagerProfileSidebar, type ManagerProfileTab } from '../ManagerProfileSidebar';

const renderSidebar = (
  activeTab: ManagerProfileTab = 'profile',
  onTabChange: (tab: ManagerProfileTab) => void = vi.fn(),
): void => {
  render(<ManagerProfileSidebar activeTab={activeTab} onTabChange={onTabChange} />);
};

describe('ManagerProfileSidebar', () => {
  it('renders the workspace groups and labels without secondary descriptions', () => {
    renderSidebar();

    const navigation = screen.getByRole('navigation', { name: 'Manager workspace sections' });

    expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    expect(navigation).toHaveTextContent('Account');
    expect(navigation).toHaveTextContent('System');
    expect(navigation.querySelectorAll('button')).toHaveLength(2);
    navigation.querySelectorAll('button').forEach((button) => {
      expect(button.querySelectorAll('p, small')).toHaveLength(0);
    });
  });

  it('marks only the active workspace section as pressed', () => {
    renderSidebar('settings');

    expect(screen.getByRole('button', { name: 'Platform Settings' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Profile Overview' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the selected section to the parent', () => {
    const onTabChange = vi.fn<(tab: ManagerProfileTab) => void>();
    renderSidebar('profile', onTabChange);

    fireEvent.click(screen.getByRole('button', { name: 'Platform Settings' }));

    expect(onTabChange).toHaveBeenCalledWith('settings');
  });
});

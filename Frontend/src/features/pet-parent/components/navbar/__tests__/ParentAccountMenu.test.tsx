import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { PetParentSettingsModal } from '../../PetParentSettingsModal';
import { ParentAccountMenu, type ParentAccount } from '../ParentAccountMenu';

vi.mock('../../../../../shared/auth/api/authApi', () => ({
  authApi: { logout: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
}));

const ACCOUNT: ParentAccount = {
  name: 'Phuong Nguyen',
  email: 'phuong@example.com',
  avatarUrl: null,
};

afterEach(() => {
  useConciergeStore.getState().setLocale('en');
});

describe('ParentAccountMenu in Chinese', () => {
  it('names the button and every item in Chinese, and switches back to English', () => {
    useConciergeStore.getState().setLocale('zh');
    render(
      <MemoryRouter>
        <ParentAccountMenu account={ACCOUNT} onOpenSettings={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }));

    expect(screen.getByRole('link', { name: '个人资料' })).toHaveAttribute(
      'href',
      '/parent/profile',
    );
    expect(screen.getByRole('link', { name: '留下反馈' })).toHaveAttribute(
      'href',
      '/parent/feedback',
    );
    expect(screen.getByRole('button', { name: '账户设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leave feedback' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});

describe('PetParentSettingsModal in Chinese', () => {
  it('titles the dialog and its close button in Chinese, and switches back to English', () => {
    useConciergeStore.getState().setLocale('zh');
    render(<PetParentSettingsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: '账户设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭账户设置' })).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('dialog', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close account settings' })).toBeInTheDocument();
  });
});

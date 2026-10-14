import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  SiteLanguageContext,
  SiteLanguageSwitchContext,
  type SiteLanguage,
} from '../../../i18n/siteLanguage';
import { englishWordsIn } from '../../../i18n/testing/englishWordsIn';
import { useAuthStore } from '../../store/authStore';
import { AccessibilityWidget } from '../../../accessibility';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { LoginPage } from '../LoginPage';
import { SignupPage } from '../SignupPage';

/** Stands in for the app's provider: a language and a working switch. */
const WithLanguage = ({ children }: { children: ReactElement }): ReactElement => {
  const [language, setLanguage] = useState<SiteLanguage>('zh');
  return (
    <SiteLanguageSwitchContext.Provider value={setLanguage}>
      <SiteLanguageContext.Provider value={language}>{children}</SiteLanguageContext.Provider>
    </SiteLanguageSwitchContext.Provider>
  );
};

const renderAt = (path: string): void => {
  render(
    <WithLanguage>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
        <AccessibilityWidget />
      </MemoryRouter>
    </WithLanguage>,
  );
};

const queue = (ok: boolean, body: Record<string, unknown>): void => {
  (globalThis.fetch as Mock).mockResolvedValueOnce({ ok, json: async () => body });
};

describe('sign-in pages in Chinese', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the sign-in page in Chinese and words a server refusal in Chinese', async () => {
    queue(true, { data: { clientId: 'mock-id' } });
    queue(false, { code: 404, msg: 'Email not registered.', data: null });
    renderAt('/login');

    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'nobody@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    });

    expect(await screen.findByText('找不到这个邮箱对应的 Wagstay 账户。')).toBeInTheDocument();
    expect(screen.queryByText('Email not registered.')).not.toBeInTheDocument();
    expect(englishWordsIn(document.body)).toEqual([]);
  });

  // An error raised before the switch is worded again after it.
  it('switches to English from the accessibility tools, rewording what is on screen', async () => {
    queue(true, { data: { clientId: 'mock-id' } });
    renderAt('/login');

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('请输入有效的邮箱地址。')).toBeInTheDocument();

    // The switch lives in the accessibility tools on every page, the sign-in card included.
    fireEvent.click(screen.getByRole('button', { name: '打开无障碍工具' }));
    fireEvent.click(screen.getByRole('button', { name: '切换到英文' }));

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('words the password rules and the server field rules in Chinese at sign-up', async () => {
    queue(false, {
      code: 400,
      msg: 'Signup validation failed',
      data: {
        valid: false,
        fieldErrors: {
          email: [
            { code: 'EMAIL_ALREADY_REGISTERED', message: 'This email is already registered.' },
          ],
        },
      },
    });
    renderAt('/signup');

    expect(screen.getByRole('heading', { name: '创建账户' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'taken@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    });

    await waitFor(() => {
      expect(screen.getByText('这个邮箱已经注册过了。')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '显示设置密码' })).toBeInTheDocument();
  });

  it('checks the address itself on the forgot password page', () => {
    renderAt('/forgot-password');

    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效的邮箱地址。');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

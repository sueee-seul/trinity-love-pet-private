import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationPreferencesCard } from '../components/NotificationPreferencesCard';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../notificationPreferencesApi';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { hanCharactersIn } from '../../../../shared/i18n/testing/hanCharactersIn';
import type { NotificationPreferencesResponse } from '../../types/notificationPreferences';

vi.mock('../notificationPreferencesApi', () => ({
  fetchNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

const SAVED: NotificationPreferencesResponse = {
  preferences: { locale: 'zh', digestHour: 18, quietStart: 21, quietEnd: 8, emailUpdates: false },
  saved: true,
};

const answer = (
  changes: Partial<NotificationPreferencesResponse['preferences']>,
): NotificationPreferencesResponse => ({
  saved: true,
  preferences: { ...SAVED.preferences, ...changes },
});

beforeEach(() => {
  vi.mocked(fetchNotificationPreferences).mockResolvedValue(SAVED);
});

afterEach(() => {
  vi.clearAllMocks();
  useConciergeStore.getState().setLocale('en');
});

describe('NotificationPreferencesCard', () => {
  it('loads the saved settings into the controls, with no Chinese character in English mode', async () => {
    render(<NotificationPreferencesCard />);

    expect(await screen.findByRole('radio', { name: 'Chinese' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked();
    expect(hanCharactersIn(document.body)).toEqual([]);
    expect(screen.getByRole('combobox', { name: 'Daily update arrives at' })).toHaveValue('18');
    expect(screen.getByRole('combobox', { name: 'From' })).toHaveValue('21');
    expect(screen.getByRole('combobox', { name: 'To' })).toHaveValue('8');
    expect(screen.getByRole('checkbox', { name: 'Also email me the updates' })).not.toBeChecked();
    expect(screen.getByText('Only safety notices are sent in this window.')).toBeInTheDocument();
    expect(fetchNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(updateNotificationPreferences).not.toHaveBeenCalled();
  });

  it('saves a changed hour at once, sending only that field, and says Saved', async () => {
    const user = userEvent.setup();
    vi.mocked(updateNotificationPreferences).mockResolvedValue(answer({ digestHour: 9 }));
    render(<NotificationPreferencesCard />);
    const hour = await screen.findByRole('combobox', { name: 'Daily update arrives at' });
    expect(within(hour).getByRole('option', { name: '6:00 pm' })).toHaveValue('18');
    expect(within(hour).getByRole('option', { name: '12:00 am' })).toHaveValue('0');

    await user.selectOptions(hour, '9');

    expect(updateNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(updateNotificationPreferences).toHaveBeenCalledWith({ digestHour: 9 });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(hour).toHaveValue('9');
  });

  it('says a change was not saved and sends the same change again on Try again', async () => {
    const user = userEvent.setup();
    vi.mocked(updateNotificationPreferences)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(answer({ emailUpdates: true }));
    render(<NotificationPreferencesCard />);

    await user.click(await screen.findByRole('checkbox', { name: 'Also email me the updates' }));

    expect(await screen.findByText('We could not save that change.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(updateNotificationPreferences).toHaveBeenCalledTimes(2);
    expect(updateNotificationPreferences).toHaveBeenNthCalledWith(2, { emailUpdates: true });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Also email me the updates' })).toBeChecked();
  });

  it('says the settings could not be loaded and loads them again on Try again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchNotificationPreferences)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(SAVED);
    render(<NotificationPreferencesCard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your notification settings.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('radio', { name: 'Chinese' })).toBeChecked();
    expect(fetchNotificationPreferences).toHaveBeenCalledTimes(2);
  });

  it('writes its words and the hours in Chinese, with no English left on screen', async () => {
    useConciergeStore.getState().setLocale('zh');
    render(<NotificationPreferencesCard />);

    expect(await screen.findByRole('heading', { name: '动态与通知' })).toBeInTheDocument();
    const hour = screen.getByRole('combobox', { name: '每日动态送达时间' });
    expect(within(hour).getByRole('option', { name: '下午6:00' })).toHaveValue('18');
    expect(within(hour).getByRole('option', { name: '上午12:00' })).toHaveValue('0');
    expect(screen.getByRole('combobox', { name: '从' })).toHaveValue('21');
    expect(screen.getByRole('checkbox', { name: '动态同时发到邮箱' })).toBeInTheDocument();
    expect(screen.getByText('这段时间只发送安全相关的通知。')).toBeInTheDocument();
    // Both languages are named in Chinese: 英文 and 中文.
    expect(screen.getByRole('radio', { name: '中文' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '英文' })).not.toBeChecked();
    expect(englishWordsIn(document.body, [])).toEqual([]);
  });
});

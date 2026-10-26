import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { ApiError } from '../../api/bookingApi';
import {
  cancelStay,
  previewCancellation,
  previewReschedule,
  rescheduleStay,
} from '../../api/stayChangesApi';
import { bookedStay } from '../../components/stays/__tests__/stayFixtures';
import type { PetStay } from '../../types/stays';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { MyStaysPage } from '../MyStaysPage';

vi.mock('../../api/stayChangesApi', () => ({
  previewCancellation: vi.fn(),
  cancelStay: vi.fn(),
  previewReschedule: vi.fn(),
  rescheduleStay: vi.fn(),
}));

/** 09:00 on Mon 30 Nov 2026 in Auckland, 12 days before check-in. */
const NOW = new Date('2026-11-29T20:00:00Z');

const renderInChinese = (stays: PetStay[]): ReturnType<typeof userEvent.setup> => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useConciergeStore.getState().setLocale('zh');
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MyStaysPage stays={stays} />
    </MemoryRouter>,
  );
  return user;
};

const switchToEnglish = (): void => {
  act(() => {
    useConciergeStore.getState().setLocale('en');
  });
};

const mochi = bookedStay({ bookingPetId: 'bp-mochi', pet: { id: 'pet-mochi', name: 'Mochi' } });

// A preset reason: the parent reads it in their own language.
const refusedPepper = bookedStay({
  bookingPetId: 'bp-pepper',
  bookingId: 'booking-2',
  pet: { id: 'pet-pepper', name: 'Pepper' },
  status: 'refused',
  reviewStatus: 'refused',
  refusalReason: 'We are fully booked on those dates.',
});

const reschedulePreview = {
  startDate: '2026-12-19',
  endDate: '2026-12-22',
  nights: 3,
  total: 460,
  usesFreeReschedule: true,
  holdAt: '2026-12-16T21:30:00.000Z',
  paysNow: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  useConciergeStore.getState().setLocale('en');
  vi.useRealTimers();
});

describe('My Stays in Chinese', () => {
  it('writes the page, the cards and the booking details in Chinese, and English after switching back', async () => {
    const user = renderInChinese([
      bookedStay({
        services: [
          { id: 'svc-walk', name: 'Outdoor Walk', quantity: 2, total: 30 },
          { id: 'svc-food', name: 'Food from home', quantity: 1, total: 0 },
        ],
      }),
      refusedPepper,
    ]);

    expect(screen.getByRole('heading', { level: 1, name: '我的住宿' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '即将开始（2）' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '以往' })).toBeInTheDocument();

    const biscuitCard = screen.getByRole('article', { name: 'Biscuit' });
    expect(within(biscuitCard).getByText('已确认')).toBeInTheDocument();
    expect(within(biscuitCard).getByText('3 晚 · 花园套房')).toBeInTheDocument();
    expect(within(biscuitCard).getByText(/你的卡上已冻结 \$460\.00/)).toHaveTextContent(
      '你的卡上已冻结 $460.00，办理入住时扣款。 测试：不会真正扣款。',
    );
    expect(
      within(biscuitCard).getByText('Biscuit 到店入住后，就可以查看实时照护。'),
    ).toBeInTheDocument();
    expect(within(biscuitCard).getByRole('button', { name: '改期' })).toBeInTheDocument();
    expect(within(biscuitCard).getByRole('button', { name: '取消住宿' })).toBeInTheDocument();

    const pepperCard = screen.getByRole('article', { name: 'Pepper' });
    expect(within(pepperCard).getByText('未被接受')).toBeInTheDocument();
    expect(within(pepperCard).getByText('经理的回复：那几天已经住满了。')).toBeInTheDocument();
    expect(
      within(pepperCard).getByText('很抱歉，这些日期我们无法接收 Pepper。'),
    ).toBeInTheDocument();

    await user.click(within(biscuitCard).getByRole('button', { name: '预约详情' }));
    const details = screen.getByRole('dialog', { name: '预约详情' });
    expect(within(details).getByRole('heading', { name: '住宿凭证' })).toBeInTheDocument();
    expect(within(details).getByText('户外散步 × 2')).toBeInTheDocument();
    expect(within(details).getByText('已包含')).toBeInTheDocument();
    expect(within(details).getByRole('heading', { name: '照护信息' })).toBeInTheDocument();
    expect(within(details).getByText('喂食习惯')).toBeInTheDocument();
    expect(within(details).getAllByText('未填写')).toHaveLength(4);
    // Nothing English reaches a Chinese reader: pet names and the booking reference are names.
    expect(englishWordsIn(document.body, ['Biscuit', 'Pepper', 'PB', 'AAAAAA'])).toEqual([]);
    await user.click(within(details).getByRole('button', { name: '关闭' }));

    switchToEnglish();

    expect(screen.getByRole('heading', { level: 1, name: 'My stays' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upcoming (2)' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Biscuit' })).getByText('Confirmed'),
    ).toBeInTheDocument();
  });

  it('says what cancelling costs in Chinese, and the notice follows the site language', async () => {
    vi.mocked(previewCancellation).mockResolvedValue({
      fee: 0,
      rule: 'early',
      total: 460,
      contact: { email: 'bookings@wagstay.example', phone: null },
    });
    vi.mocked(cancelStay).mockResolvedValue({ fee: 0 });
    const user = renderInChinese([bookedStay(), mochi]);

    await user.click(screen.getAllByRole('button', { name: '取消住宿' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: '取消这次住宿？' });
    expect(dialog).toHaveTextContent('这会取消 Biscuit 和 Mochi 的住宿，入住日期是 12月12日周六。');
    expect(await within(dialog).findByText('现在取消免费，不会扣任何费用。')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('遇到紧急情况或宠物生病，请改为联系我们的工作人员');
    expect(within(dialog).getByRole('button', { name: '保留住宿' })).toBeInTheDocument();

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: '取消住宿' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('已取消，没有收取任何费用。');

    switchToEnglish();
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Nothing was charged.');
  });

  it('checks and moves the dates in Chinese', async () => {
    vi.mocked(previewReschedule).mockResolvedValue(reschedulePreview);
    vi.mocked(rescheduleStay).mockResolvedValue({ ...reschedulePreview, held: false });
    const user = renderInChinese([bookedStay(), mochi]);

    await user.click(screen.getAllByRole('button', { name: '改期' })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog', { name: '更改住宿日期' });
    expect(dialog).toHaveTextContent(
      '把 Biscuit 和 Mochi 的住宿改到新的日期。如果有空位，按预订时的价格改期；入住之前可以随时改，次数不限。',
    );
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: '查询新日期' }));
    });

    const summary = within(dialog).getByRole('status');
    expect(summary).toHaveTextContent('12月19日周六 至 12月22日周二，共 3 晚。新的总价：$460.00。');
    expect(summary).toHaveTextContent(
      '这次会用掉你唯一一次免费改期。新的日期需要经理重新审核批准。',
    );

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: '确认改期' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      '你的新日期从 12月19日周六 开始，正在等待经理批准。新的总价是 $460.00。',
    );
  });

  it('names the full nights in Chinese when the new dates have no room', async () => {
    vi.mocked(previewReschedule).mockRejectedValue(
      new ApiError('Some of those nights are fully booked.', 409, {
        error: { code: 'CONCIERGE_FULLY_BOOKED', details: [{ night: '2026-12-20' }] },
      }),
    );
    const user = renderInChinese([bookedStay()]);

    await user.click(screen.getByRole('button', { name: '改期' }));
    await act(async () => {
      await user.click(screen.getByRole('button', { name: '查询新日期' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      '抱歉，12月20日周日 已经住满了，请选择其他日期。',
    );
  });

  // The server words its refusals in English; Chinese knows them by their code.
  it('words a refusal in Chinese by its code, and anything unknown in its own words', async () => {
    vi.mocked(previewReschedule)
      .mockRejectedValueOnce(
        new ApiError('This stay has started, so it cannot be changed online.', 409, {
          error: { code: 'BOOKING_STARTED' },
        }),
      )
      .mockRejectedValueOnce(new ApiError('Something new went wrong.', 409, null));
    const user = renderInChinese([bookedStay()]);

    await user.click(screen.getByRole('button', { name: '改期' }));
    const check = screen.getByRole('button', { name: '查询新日期' });
    await act(async () => {
      await user.click(check);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      '这次住宿已经开始，无法在线更改，请联系我们的工作人员。',
    );

    await act(async () => {
      await user.click(check);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('没能查询这些日期，请重试。');
  });
});

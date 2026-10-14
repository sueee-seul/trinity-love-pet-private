import { describe, expect, it } from 'vitest';
import type { ParentNotification } from '../../../types/notifications';
import { chineseStayDates, noticeWords } from '../noticeWords';

const OCTOBER = { start: '2026-10-12', end: '2026-10-15' };

const notice = (overrides: Partial<ParentNotification>): ParentNotification => ({
  id: 'n-1',
  kind: 'booking_refused',
  title: 'Not accepted',
  body: "We can't take Max on 12 to 15 Oct 2026.",
  facts: null,
  createdAt: '2026-10-01T02:00:00.000Z',
  readAt: null,
  ...overrides,
});

describe('noticeWords', () => {
  it('shows the English notice as written', () => {
    expect(noticeWords(notice({}), 'en')).toEqual({
      title: 'Not accepted',
      body: "We can't take Max on 12 to 15 Oct 2026.",
    });
  });

  it('says a refusal in Chinese, with a preset reason translated', () => {
    const refused = notice({
      facts: {
        template: 'refused',
        pets: ['Max', 'Bella'],
        dates: OCTOBER,
        reason: 'We are fully booked on those dates.',
      },
    });

    expect(noticeWords(refused, 'zh')).toEqual({
      title: '未被接受',
      body: '很抱歉，我们无法接收 Max 和 Bella（2026年10月12日至15日）。原因：那几天已经住满了。',
    });
  });

  // Words a manager typed before the presets: no English reaches the Chinese bell.
  it('points to My stays for a reason typed in English', () => {
    const refused = notice({
      facts: { template: 'refused', pets: ['Max'], dates: null, reason: 'Full that week.' },
    });

    expect(noticeWords(refused, 'zh').body).toBe(
      '很抱歉，我们无法接收 Max。原因是用英文写的，详情请查看“我的住宿”。',
    );
  });

  it('says moved dates and a waiting pet with its reason', () => {
    expect(
      noticeWords(
        notice({
          kind: 'booking_back_in_review',
          facts: { template: 'moved', pets: [], dates: OCTOBER },
        }),
        'zh',
      ).body,
    ).toBe('你把 你的宠物 的住宿改到了 2026年10月12日至15日。经理会审核新的日期。');
    expect(
      noticeWords(
        notice({
          kind: 'booking_request_received',
          facts: {
            template: 'received',
            reference: 'PB-1',
            dates: null,
            confirmed: ['Max'],
            waiting: [{ name: 'Bella', reasons: ['medication'] }],
          },
        }),
        'zh',
      ).body,
    ).toBe(
      '我们收到了你的申请 PB-1。Max 已确认。经理会先查看Bella（要用药），然后再确认。详情请查看“我的住宿”。',
    );
  });

  it('gives a general line when the server could not read the notice', () => {
    expect(noticeWords(notice({ kind: 'booking_approved' }), 'zh')).toEqual({
      title: '已确认',
      body: '你的一次住宿已确认。详情请查看“我的住宿”。',
    });
  });

  // The server writes these three in the parent's chosen language, so Chinese is already Chinese.
  it('shows a daily update the server wrote in Chinese as written', () => {
    const chinese = notice({
      kind: 'booking_daily_update',
      title: "Today's update",
      body: 'Max 今天吃了 2 餐，散步 1 次。',
    });

    expect(noticeWords(chinese, 'zh')).toEqual({
      title: '今日动态',
      body: 'Max 今天吃了 2 餐，散步 1 次。',
    });
  });

  it('still gives the general line for a stay report written in English', () => {
    const english = notice({
      kind: 'booking_stay_report',
      title: 'How the stay went',
      body: 'Max stayed 4 nights. Every dose was given.',
    });

    expect(noticeWords(english, 'zh').body).toBe(
      '这次住宿的报告已经发出，请到“照顾动态”查看。详情请查看“我的住宿”。',
    );
  });

  it('titles the arrival note and shows its body as written when it is Chinese', () => {
    const english = notice({
      kind: 'booking_arrival_note',
      title: 'Settled in',
      body: 'Max has arrived and is settling in.',
    });
    const chinese = notice({ kind: 'booking_arrival_note', body: 'Max 已经到店，正在安顿。' });

    expect(noticeWords(english, 'zh')).toEqual({
      title: '已安顿',
      body: '你的宠物已经到店，正在安顿。详情请查看“我的住宿”。',
    });
    expect(noticeWords(chinese, 'zh').body).toBe('Max 已经到店，正在安顿。');
    expect(noticeWords(english, 'en')).toEqual({
      title: 'Settled in',
      body: 'Max has arrived and is settling in.',
    });
  });

  // No longer sent since pick-up coordination was removed; older notices still get their general line.
  it('titles the check-out notices in Chinese with their general lines', () => {
    expect(noticeWords(notice({ kind: 'booking_picked_up', title: 'Picked up' }), 'zh')).toEqual({
      title: '已离店',
      body: '你的宠物已经离店。详情请查看“我的住宿”。',
    });
    expect(
      noticeWords(
        notice({ kind: 'booking_late_pickup_charged', title: 'Late check-out charged' }),
        'zh',
      ),
    ).toEqual({
      title: '延迟离店费用已扣',
      body: '离店时间晚于截止时间，已按约定扣了一晚的费用。详情请查看“我的住宿”。',
    });
  });

  it('writes stay dates across months and years', () => {
    expect(chineseStayDates({ start: '2026-09-28', end: '2026-10-02' })).toBe(
      '2026年9月28日至10月2日',
    );
    expect(chineseStayDates({ start: '2026-12-30', end: '2027-01-02' })).toBe(
      '2026年12月30日至2027年1月2日',
    );
  });
});

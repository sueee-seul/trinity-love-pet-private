import { describe, expect, it } from 'vitest';
import { CONCIERGE_COPY, type ConciergeCopy } from '../copy';
import type { ConciergeLocale } from '../types';

/**
 * The booking copy may not promise what is not true. Nothing is booked or confirmed before our
 * manager approves each pet (Fair Trading Act s9, s11), the safety tasks do not decide approval,
 * and Wagstay's own rules are never presented as law (s13(i)).
 */

/** Every fixed string in the copy, found by walking it. Functions are sentence builders with
 * placeholders; the promises checked here all live in fixed strings. */
const fixedStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(fixedStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(fixedStrings);
  return [];
};

const LOCALES: ConciergeLocale[] = ['en', 'zh'];
const allText = (copy: ConciergeCopy): string => fixedStrings(copy).join('\n');

/**
 * Every string except those shown only once the server has confirmed a stay: the Sent screen's
 * title, lead and calendar name for a confirmed or partly confirmed booking, and the Confirmed
 * badge. Nothing else may promise a confirmed stay.
 */
const textBeforeConfirmation = (copy: ConciergeCopy): string =>
  allText({
    ...copy,
    done: {
      ...copy.done,
      titles: { ...copy.done.titles, confirmed: '', partly_confirmed: '' },
      leads: { ...copy.done.leads, confirmed: '', partly_confirmed: '' },
      calendarTitles: { ...copy.done.calendarTitles, confirmed: '' },
      confirmed: '',
    },
  });

describe('the booking copy', () => {
  it.each([
    /confirmed once/i,
    /stay is confirmed/i,
    /booking is confirmed/i,
    /becomes a confirmed booking/i,
    /approves every request/i,
    /boarding pass shows/i,
    /your booking reaches/i,
    /become a booking/i,
    /when you book,/i,
    /about this booking/i,
    /required by law|the law requires|legal requirement/i,
  ])('never says %s before the server confirmed a stay, in English', (promise) => {
    expect(textBeforeConfirmation(CONCIERGE_COPY.en)).not.toMatch(promise);
  });

  it.each([
    '住宿就正式确认',
    '住宿才正式确认',
    '预约才会正式生效',
    '预约才正式生效',
    '住宿凭证上的内容',
    '确保预约交到',
    '没有变成预约的对话',
    '法律要求',
  ])('never says %s before the server confirmed a stay, in Chinese', (promise) => {
    expect(textBeforeConfirmation(CONCIERGE_COPY.zh)).not.toContain(promise);
  });

  it('says a stay waiting for our manager is not booked yet', () => {
    expect(CONCIERGE_COPY.en.done.waitingNotBooked).toBe(
      'A stay waiting for review is not booked yet. We will not take any money for a pet we cannot take.',
    );
    expect(CONCIERGE_COPY.zh.done.waitingNotBooked).toBe(
      '等待审核的住宿还没有预约成功。我们接收不了的宠物，不会收取任何费用。',
    );
  });

  // The owner's rule, told before sending: which stays our manager checks first.
  it.each(LOCALES)(
    'names every case our manager checks first before the guest sends (%s)',
    (locale) => {
      const { details } = CONCIERGE_COPY[locale];
      for (const reason of Object.values(details.review.reasons)) {
        expect(reason.trim()).not.toBe('');
      }
      const notice = details.requestNotice;
      const expected =
        locale === 'en' ? ['medication', 'not booked yet'] : ['用药', '还没有预约成功'];
      for (const part of expected) expect(notice).toContain(part);
      // Only medication sends a stay to our manager (owner decision of 2026-10-05).
      const dropped =
        locale === 'en'
          ? ['behaviour or health', 'first time', '14 nights']
          : ['行为或健康', '第一次来住', '14 晚'];
      for (const part of dropped) expect(notice).not.toContain(part);
    },
  );

  it('asks for the vaccination dates, labels the vaccine list as our rule and explains the separate room', () => {
    const terms = CONCIERGE_COPY.en.details.termsSummary.join(' ');
    expect(terms).toContain('shows the date given and the next due date');
    expect(terms).toContain('(C5 for dogs, F3 for cats) are our own rule, not a law');
    expect(terms).toContain(
      'A pet without vaccination proof still stays with us, kept apart from other pets until its vaccination status is known, at no extra cost.',
    );

    const zhTerms = CONCIERGE_COPY.zh.details.termsSummary.join('');
    expect(zhTerms).toContain('接种日期和下次接种日期');
    expect(zhTerms).toContain('是我们自己的规定，不是法律规定');
    expect(zhTerms).toContain('会和其他宠物分开安置，不额外收费');
  });

  it('names a calendar event not yet confirmed unless every stay is confirmed', () => {
    const { en, zh } = CONCIERGE_COPY;
    expect(en.done.calendarTitles.awaiting_manager_approval).toBe(
      'Wagstay request (not yet confirmed)',
    );
    expect(en.done.calendarTitles.partly_confirmed).toContain('not yet confirmed');
    expect(en.done.calendarTitles.confirmed).toBe('Wagstay stay');
    expect(zh.done.calendarTitles.awaiting_manager_approval).toBe('Wagstay 住宿申请（尚未确认）');
    expect(zh.done.calendarTitles.partly_confirmed).toContain('尚未确认');
  });

  // Current online agreements record consent; legacy receipts retain their old task detail.
  it('asks for emergency vet consent with its own tick, in both languages', () => {
    const { en, zh } = CONCIERGE_COPY;
    expect(en.packages.nextSteps).toContain(
      'Before check-in, add vaccination proof. You give emergency vet consent, up to NZ$500, with its own tick when you send the booking.',
    );
    expect(en.details.vetConsentCheckbox).toContain('NZ$500');
    expect(en.details.agreeCheckbox).not.toMatch(/vet/i);
    expect(en.done.tasks.emergency_vet_consent.detail).toContain('own tick');
    expect(en.done.teamCollects).toBe('Our team will go through this with you by check-in.');
    expect(allText(en)).not.toMatch(/before check-in, you add [^.]*consent/i);

    expect(zh.packages.nextSteps).toContain(
      '入住前添加疫苗证明；提交预约时单独勾选，同意联系不上你时安排不超过 NZ$500 的紧急兽医治疗。',
    );
    expect(zh.details.vetConsentCheckbox).toContain('NZ$500');
    expect(zh.done.tasks.emergency_vet_consent.detail).toContain('单独勾选');
    expect(zh.done.teamCollects).toBe('最晚在入住时，工作人员会和你一起完成这一项。');
  });

  it.each(LOCALES)('uses no em dash or en dash (%s)', (locale) => {
    expect(allText(CONCIERGE_COPY[locale])).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('the greeting', () => {
  const MODES = ['model', 'rules', 'unknown'] as const;

  it.each(LOCALES)('says AI only for the model, and never uses a dash (%s)', (locale) => {
    const { greeting } = CONCIERGE_COPY[locale].chat;
    for (const mode of MODES) expect(greeting(mode)).not.toMatch(/[\u2013\u2014]/);
    expect(greeting('model')).toMatch(/AI/);
    expect(greeting('rules')).not.toMatch(/AI/);
    expect(greeting('unknown')).not.toMatch(/AI/);
  });

  it('warns that the model can be wrong, and that the keyword helper is limited', () => {
    const { greeting } = CONCIERGE_COPY.en.chat;
    expect(greeting('model')).toContain('I can get things wrong');
    expect(greeting('rules')).toContain('simple phrases only');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderKpiReportEmail } from '../services/kpi.report.email.render.js';
import {
  createReportEmailSender,
  readReportEmailSettings,
  resolveRecipients,
} from '../services/kpi.report.email.sender.js';
import type { KpiReportContent } from '../services/kpi.report.service.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const CONTENT: KpiReportContent = {
  type: 'weekly',
  period: { start: '2026-09-21', end: '2026-09-28' },
  periodLabel: '21 Sep to 27 Sep',
  previous: { start: '2026-09-14', end: '2026-09-21' },
  previousLabel: '14 Sep to 20 Sep',
  trends: ['Overdue rate up 3 weeks in a row (5% → 8% → 11% → 14%)'],
  headline: 'Overdue rose <again>.',
  keyNumbers: [
    {
      key: 'onTimeRate',
      label: 'On-time rate',
      unit: '%',
      current: 79,
      previous: 86.2,
      change: -7.2,
      worse: true,
    },
  ],
  movers: ['Walking overdue 3 → 15'],
  staff: [{ name: 'aria.singh', scheduled: 40, completed: 36, completionRate: 90, overdue: 6 }],
  delayReasons: [{ theme: 'Weather', count: 2, example: 'Heavy rain all afternoon.' }],
  delayReasonCount: 2,
};

describe('KPI report email', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends only to the test recipient when one is set', () => {
    expect(resolveRecipients(['a@wagstay.test', 'b@wagstay.test'], 'sue@example.com')).toEqual([
      'sue@example.com',
    ]);
    expect(resolveRecipients(['a@wagstay.test'], null)).toEqual(['a@wagstay.test']);
  });

  it('defaults to console mode and requires a key for resend', () => {
    expect(readReportEmailSettings({})).toMatchObject({
      mode: 'console',
      from: 'onboarding@resend.dev',
      testRecipient: null,
    });
    expect(() => readReportEmailSettings({ KPI_EMAIL_MODE: 'resend' })).toThrow('RESEND_API_KEY');
  });

  it('renders points, the test notice and escapes text', () => {
    const email = renderKpiReportEmail(CONTENT, {
      reportUrl: 'http://localhost:5173/admin/kpi-reports/abc',
      intendedRecipients: ['a@wagstay.test'],
    });

    expect(email.subject).toBe('Weekly KPI report: 21 Sep to 27 Sep');
    expect(email.html).toContain('▼ 7.2 pts');
    expect(email.html).toContain('Test send. This report is for: a@wagstay.test.');
    expect(email.html).toContain('Overdue rose &lt;again&gt;.');
    expect(email.text).toContain('On-time rate: 79% (previous 86.2%, ▼ 7.2 pts)');
    expect(email.text).toContain('- Weather: 2 (e.g. "Heavy rain all afternoon.")');
  });

  it('prints the email in console mode', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const send = createReportEmailSender(readReportEmailSettings({}));

    await send({ to: ['sue@example.com'], subject: 'Subject', html: '<p>x</p>', text: 'Body' });

    expect(info).toHaveBeenCalledWith(expect.stringContaining('To: sue@example.com'));
  });

  it('posts to Resend and fails clearly when it is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve('domain') });
    vi.stubGlobal('fetch', fetchMock);
    const send = createReportEmailSender(
      readReportEmailSettings({ KPI_EMAIL_MODE: 'resend', RESEND_API_KEY: 're_test' }),
    );
    const email = { to: ['sue@example.com'], subject: 'S', html: '<p>x</p>', text: 'x' };

    await send(email);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test' }),
      }),
    );

    await expect(send(email)).rejects.toThrow('Resend rejected the email (403): domain');
  });
});

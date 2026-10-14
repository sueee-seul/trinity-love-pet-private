import { z } from 'zod';

export type ReportEmailMode = 'console' | 'resend';

/** What happened to a report's email, saved on the report. */
export interface ReportEmailLog {
  mode: ReportEmailMode;
  /** Managers the report is for (from employees with staff_role = 'manager'). */
  intendedRecipients: string[];
  /** Where it was actually sent (the test recipient when one is set). */
  sentTo: string[];
  status: 'sent' | 'failed' | 'skipped';
  sentAt: string | null;
  error: string | null;
}

export interface ReportEmail {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export type ReportEmailSender = (email: ReportEmail) => Promise<void>;

export interface ReportEmailSettings {
  mode: ReportEmailMode;
  apiKey: string | null;
  from: string;
  /** Without a verified domain Resend only delivers to the account's own email. */
  testRecipient: string | null;
  appUrl: string;
}

type EmailEnvironment = Readonly<Record<string, string | undefined>>;

const emptyAsMissing = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const emailEnvironmentSchema = z
  .object({
    KPI_EMAIL_MODE: z.enum(['console', 'resend']).default('console'),
    RESEND_API_KEY: z.preprocess(emptyAsMissing, z.string().trim().min(1).optional()),
    KPI_REPORT_FROM: z.preprocess(
      emptyAsMissing,
      z.string().trim().min(1).default('onboarding@resend.dev'),
    ),
    KPI_REPORT_TEST_RECIPIENT: z.preprocess(emptyAsMissing, z.string().trim().email().optional()),
    KPI_REPORT_APP_URL: z.preprocess(
      emptyAsMissing,
      z.string().trim().url().default('http://localhost:5173'),
    ),
  })
  .refine((environment) => environment.KPI_EMAIL_MODE !== 'resend' || environment.RESEND_API_KEY, {
    message: 'RESEND_API_KEY is required when KPI_EMAIL_MODE=resend',
    path: ['RESEND_API_KEY'],
  });

export const readReportEmailSettings = (
  environment: EmailEnvironment = process.env,
): ReportEmailSettings => {
  const parsed = emailEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid KPI report email configuration: ${issues}`);
  }
  return {
    mode: parsed.data.KPI_EMAIL_MODE,
    apiKey: parsed.data.RESEND_API_KEY ?? null,
    from: parsed.data.KPI_REPORT_FROM,
    testRecipient: parsed.data.KPI_REPORT_TEST_RECIPIENT ?? null,
    appUrl: parsed.data.KPI_REPORT_APP_URL.replace(/\/$/, ''),
  };
};

/** A test recipient replaces the manager list, so every send goes to one inbox. */
export const resolveRecipients = (managers: string[], testRecipient: string | null): string[] =>
  testRecipient ? [testRecipient] : managers;

/** console mode: prints the email in the Backend log instead of sending it. */
const sendToConsole: ReportEmailSender = (email) => {
  console.info(
    `[KPI report email] To: ${email.to.join(', ')}\nSubject: ${email.subject}\n\n${email.text}`,
  );
  return Promise.resolve();
};

const RESEND_API_URL = 'https://api.resend.com/emails';

const createResendSender =
  (apiKey: string, from: string): ReportEmailSender =>
  async (email) => {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
    }
  };

export const createReportEmailSender = (settings: ReportEmailSettings): ReportEmailSender =>
  settings.mode === 'resend' && settings.apiKey
    ? createResendSender(settings.apiKey, settings.from)
    : sendToConsole;

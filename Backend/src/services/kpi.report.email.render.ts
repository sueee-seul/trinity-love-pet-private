import type { KeyNumberChange } from './kpi.report.compare.js';
import type { KpiReportContent } from './kpi.report.service.js';
import { REPORT_TYPE_LABELS } from './kpi.report.periods.js';

export interface RenderedReportEmail {
  subject: string;
  html: string;
  text: string;
}

export interface RenderOptions {
  reportUrl: string;
  /** Set on a test send: the managers the report was meant for. */
  intendedRecipients: string[] | null;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatValue = (value: number | null, unit: KeyNumberChange['unit']): string => {
  if (value === null) {
    return 'n/a';
  }
  if (unit === '%') {
    return `${value}%`;
  }
  return unit === 'm' ? `${value}m` : String(value);
};

/** Rate changes are percentage points ("pts"), not percent. */
export const formatChange = ({ change, unit }: KeyNumberChange): string => {
  if (change === null) {
    return 'n/a';
  }
  if (change === 0) {
    return 'no change';
  }
  const arrow = change > 0 ? '▲' : '▼';
  const size = Math.abs(change);
  if (unit === '%') {
    return `${arrow} ${size} pts`;
  }
  return unit === 'm' ? `${arrow} ${size}m` : `${arrow} ${size}`;
};

const heading = (title: string): string =>
  `<h2 style="font-size:16px;margin:24px 0 8px">${escapeHtml(title)}</h2>`;

const list = (items: string[]): string =>
  `<ul style="margin:0;padding-left:20px">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

const table = (header: string[], rows: string[][]): string =>
  `<table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr>${header
    .map(
      (cell) =>
        `<th style="text-align:left;border-bottom:1px solid #ddd;padding:6px">${escapeHtml(cell)}</th>`,
    )
    .join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td style="border-bottom:1px solid #eee;padding:6px">${cell}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table>`;

/** One report, rendered the same way for the email HTML and its plain text part. */
export const renderKpiReportEmail = (
  content: KpiReportContent,
  options: RenderOptions,
): RenderedReportEmail => {
  const title = `${REPORT_TYPE_LABELS[content.type]} KPI report`;
  const subject = `${title}: ${content.periodLabel}`;
  const keyRows = content.keyNumbers.map((item) => [
    escapeHtml(item.label),
    escapeHtml(formatValue(item.current, item.unit)),
    escapeHtml(formatValue(item.previous, item.unit)),
    `<span style="color:${item.worse ? '#c0392b' : '#555'}">${escapeHtml(formatChange(item))}</span>`,
  ]);
  const staffRows = content.staff.map((person) => [
    escapeHtml(person.name),
    String(person.scheduled),
    escapeHtml(formatValue(person.completionRate, '%')),
    String(person.overdue),
  ]);
  const reasonItems = content.delayReasons.map(
    ({ theme, count, example }) => `${theme}: ${count} (e.g. "${example}")`,
  );

  const sections = [
    options.intendedRecipients
      ? `<p style="background:#fff4e5;padding:8px">Test send. This report is for: ${escapeHtml(options.intendedRecipients.join(', ') || 'no managers found')}.</p>`
      : '',
    `<h1 style="font-size:20px;margin:0">${escapeHtml(subject)}</h1>`,
    `<p style="color:#555;margin:4px 0 0">Compared with ${escapeHtml(content.previousLabel)}</p>`,
    content.trends.length > 0
      ? heading('Trend warnings') + list(content.trends.map((trend) => `⚠ ${trend}`))
      : '',
    heading('Summary'),
    `<p>${escapeHtml(content.headline ?? 'The written summary is not available for this report.')}</p>`,
    heading('Key numbers'),
    table(['Metric', 'This period', 'Previous', 'Change'], keyRows),
    content.movers.length > 0 ? heading('Biggest changes') + list(content.movers) : '',
    content.staff.length > 0
      ? heading('Staff') + table(['Staff', 'Scheduled', 'Completion', 'Overdue'], staffRows)
      : '',
    heading('Main delay reasons'),
    reasonItems.length > 0
      ? list(reasonItems)
      : `<p>${content.delayReasonCount > 0 ? `${content.delayReasonCount} delay reasons were recorded but could not be grouped.` : 'No delay reasons were recorded.'}</p>`,
    `<p style="margin-top:24px"><a href="${escapeHtml(options.reportUrl)}">Open this report in the app</a> · charts are on the KPI dashboard.</p>`,
  ];

  const text = [
    options.intendedRecipients
      ? `Test send. This report is for: ${options.intendedRecipients.join(', ') || 'no managers found'}.`
      : '',
    subject,
    `Compared with ${content.previousLabel}`,
    ...content.trends.map((trend) => `! ${trend}`),
    '',
    content.headline ?? 'The written summary is not available for this report.',
    '',
    ...content.keyNumbers.map(
      (item) =>
        `${item.label}: ${formatValue(item.current, item.unit)} (previous ${formatValue(item.previous, item.unit)}, ${formatChange(item)})`,
    ),
    '',
    ...content.movers.map((mover) => `* ${mover}`),
    '',
    ...content.staff.map(
      (person) =>
        `${person.name}: ${person.scheduled} scheduled, ${formatValue(person.completionRate, '%')} completed, ${person.overdue} overdue`,
    ),
    '',
    'Main delay reasons:',
    ...(reasonItems.length > 0 ? reasonItems.map((item) => `- ${item}`) : ['None recorded.']),
    '',
    `Open this report: ${options.reportUrl}`,
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');

  return {
    subject,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:640px">${sections.join('')}</div>`,
    text,
  };
};

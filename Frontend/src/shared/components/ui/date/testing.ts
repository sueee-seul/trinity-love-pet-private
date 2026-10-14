import type { UserEvent } from '@testing-library/user-event';
import { parseIsoDate } from './dateValue';

/*
 * Test helpers for the date and time fields. Only tests import this file.
 *
 * They find calendar parts by data attributes and the library's `rdp-*` class names rather than
 * by visible text, so the same helper works for the English and the Chinese calendar.
 */

// Twenty years of month clicks is far more than any test should need; it stops a runaway loop.
const MAX_MONTH_STEPS = 240;

/** The calendar dialog that is open now. Throws when none is open. */
export function getOpenCalendar(): HTMLDialogElement {
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (!dialog) throw new Error('No calendar dialog is open.');
  return dialog;
}

/** The button for a day of the month on show, or null when that day is not on show. */
export function getCalendarDayButton(isoDate: string): HTMLButtonElement | null {
  return getOpenCalendar().querySelector<HTMLButtonElement>(
    `td[data-day="${isoDate}"]:not([data-outside]) button`,
  );
}

function shownMonth(dialog: HTMLDialogElement): string {
  const firstDay = dialog.querySelector<HTMLElement>('td[data-day]:not([data-outside])');
  const isoDay = firstDay?.dataset.day;
  if (!isoDay) throw new Error('The calendar shows no days.');
  return isoDay.slice(0, 7);
}

async function moveToMonth(
  user: UserEvent,
  dialog: HTMLDialogElement,
  target: Date,
): Promise<void> {
  const years = dialog.querySelector<HTMLSelectElement>('select.rdp-years_dropdown');
  const months = dialog.querySelector<HTMLSelectElement>('select.rdp-months_dropdown');
  if (years && months) {
    await user.selectOptions(years, String(target.getFullYear()));
    await user.selectOptions(months, String(target.getMonth()));
    return;
  }
  const targetMonth = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  for (let step = 0; step < MAX_MONTH_STEPS; step += 1) {
    const current = shownMonth(dialog);
    if (current === targetMonth) return;
    const direction = current < targetMonth ? 'next' : 'previous';
    const button = dialog.querySelector<HTMLButtonElement>(`button.rdp-button_${direction}`);
    if (!button || button.getAttribute('aria-disabled') === 'true') {
      throw new Error(`The calendar cannot move to ${targetMonth}; it is outside min or max.`);
    }
    await user.click(button);
  }
  throw new Error(`The calendar did not reach ${targetMonth}.`);
}

/** Opens the calendar from its trigger, moves to the month of `isoDate` and picks that day. */
export async function chooseDate(
  user: UserEvent,
  trigger: HTMLElement,
  isoDate: string,
): Promise<void> {
  const target = parseIsoDate(isoDate);
  if (!target) throw new Error(`"${isoDate}" is not a YYYY-MM-DD date.`);
  await user.click(trigger);
  const dialog = getOpenCalendar();
  await moveToMonth(user, dialog, target);
  const dayButton = getCalendarDayButton(isoDate);
  if (!dayButton) throw new Error(`${isoDate} is not on the calendar.`);
  if (dayButton.disabled) throw new Error(`${isoDate} cannot be picked; it is outside min or max.`);
  await user.click(dayButton);
}

/** Picks "HH:mm" in a TimeField select. */
export async function chooseTime(
  user: UserEvent,
  select: HTMLElement,
  time: string,
): Promise<void> {
  if (!(select instanceof HTMLSelectElement))
    throw new Error('chooseTime needs the time <select>.');
  await user.selectOptions(select, time);
}

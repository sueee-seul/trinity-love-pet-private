import type { ConciergeCopy } from '../copy';
import type { ConciergeLocale, ConciergeNeeds, ConciergeQuote } from '../types';
import { chosenExtraLabels } from './extras';
import { formatClockTime, formatDateRange, formatNzd, nightsBetween } from './format';
import { stayNameText } from './stayName';

/**
 * A plain-text copy of the plan for "Send this plan to our team" and "Copy my plan".
 *
 * It holds only the plan (dates, how many pets and of what kind, the stay as built and its price),
 * never the guest's name or contact details. The guest sends it from their own mail app, so
 * nothing is stored by us until they choose to send it.
 */

export const buildPlanSummary = (
  copy: ConciergeCopy,
  locale: ConciergeLocale,
  needs: ConciergeNeeds,
  stay: ConciergeQuote | null,
): string => {
  const { planLines } = copy.handoff;
  const lines = [copy.handoff.planHeading];
  if (needs.startDate && needs.endDate) {
    lines.push(
      `${planLines.dates}: ${formatDateRange(needs.startDate, needs.endDate, locale)} (${copy.stay.nights(
        nightsBetween(needs.startDate, needs.endDate),
      )})`,
    );
  }
  if (needs.pets.length > 0) {
    const pets = needs.pets.map((pet) => {
      const species = pet.species ? copy.checklist[pet.species] : '?';
      return pet.size ? `${species} (${copy.checklist[pet.size]})` : species;
    });
    lines.push(`${planLines.pets}: ${pets.join(copy.listJoiner)}`);
  }
  if (stay) {
    // The stay names every service its price covers, so the asked-for extras are not repeated.
    const petNames = needs.pets.map((pet) => pet.name);
    lines.push(`${planLines.option}: ${stayNameText(stay.lines, petNames, copy, locale)}`);
    lines.push(`${planLines.total}: ${formatNzd(stay.total)}`);
    lines.push(copy.packages.validUntil(formatClockTime(stay.expiresAt, locale)));
  } else {
    const extras = chosenExtraLabels(copy, needs.extras);
    if (extras.length > 0) lines.push(`${planLines.extras}: ${extras.join(copy.listJoiner)}`);
  }
  return lines.join('\n');
};

/**
 * The stay in one short line, such as "Mon 12 Oct to Thu 15 Oct · 3 nights · 2 pets", for the
 * stay card while it is folded on a phone, so what was understood shows without opening it.
 * Dates that cannot be quoted are left out: the status line under it explains those.
 */
export const stayAtAGlance = (
  copy: ConciergeCopy,
  locale: ConciergeLocale,
  needs: ConciergeNeeds,
): string | null => {
  const { startDate, endDate } = needs;
  const parts: string[] = [];
  if (startDate && endDate && endDate > startDate) {
    parts.push(
      formatDateRange(startDate, endDate, locale),
      copy.stay.nights(nightsBetween(startDate, endDate)),
    );
  }
  if (needs.pets.length > 0) parts.push(copy.stay.pets(needs.pets.length));
  return parts.length > 0 ? parts.join(' · ') : null;
};

/** A mailto link the guest's own mail app opens with the plan filled in. */
export const planMailtoHref = (email: string, subject: string, body: string): string =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

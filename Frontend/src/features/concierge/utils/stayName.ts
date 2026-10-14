import type { ConciergeCopy } from '../copy';
import type { ConciergeLocale, ConciergeQuoteLine } from '../types';
import { serviceNameText } from './serviceNames';

/**
 * The name of a stay, made from its lines the way the Backend makes `quote.name`
 * (concierge.quotes.ts `nameFor`), but with each service in the reader's language. The server's
 * name joins English catalogue names with "and", so it is never shown as it is on the Chinese page.
 */

const joinNames = (names: string[], copy: ConciergeCopy, locale: ConciergeLocale): string => {
  if (locale === 'zh' || names.length <= 1) return names.join(copy.listJoiner);
  return `${names.slice(0, -1).join(copy.listJoiner)} and ${names[names.length - 1]}`;
};

const namesByPet = (lines: ConciergeQuoteLine[], locale: ConciergeLocale): string[][] => {
  const petCount = lines.reduce((count, line) => Math.max(count, line.petIndex + 1), 0);
  return Array.from({ length: petCount }, (_unused, petIndex) =>
    lines
      .filter((line) => line.petIndex === petIndex)
      .map((line) => serviceNameText(line.name, locale)),
  );
};

/**
 * Pets with the same choice share one list; otherwise each pet gets its own, headed by its name
 * or "Pet 2" when the name is not known (after a reload the receipt keeps no names).
 */
export const stayNameText = (
  lines: ConciergeQuoteLine[],
  petNames: ReadonlyArray<string | undefined>,
  copy: ConciergeCopy,
  locale: ConciergeLocale,
): string => {
  const perPet = namesByPet(lines, locale);
  const first = perPet[0] ?? [];
  const allSame = perPet.every((names) => names.join('|') === first.join('|'));
  if (allSame) return joinNames(first, copy, locale);
  return perPet
    .map(
      (names, index) =>
        `${petNames[index] ?? copy.packages.forPet(index)}: ${joinNames(names, copy, locale)}`,
    )
    .join('; ');
};

/** The distinct add-ons a stay's price covers, in the reader's language. */
export const addonNamesIn = (lines: ConciergeQuoteLine[], locale: ConciergeLocale): string[] =>
  Array.from(
    new Set(
      lines
        .filter((line) => line.category === 'addon')
        .map((line) => serviceNameText(line.name, locale)),
    ),
  );

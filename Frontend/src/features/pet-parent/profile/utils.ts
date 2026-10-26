import type { PortalCopy, PortalLocale } from '../i18n/portalLocale';
import type { Species } from './types';

/** The calendar each language writes dates in: "18 Apr 1992" in English, year-month-day in Chinese. */
const DATE_LOCALES: PortalCopy<string> = { en: 'en-NZ', zh: 'zh-CN' };

export function formatDate(iso: string, locale: PortalLocale = 'en'): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Up to two initials, for an avatar that has no photo. Empty for a blank name. */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const MONTHS_PER_YEAR = 12;

interface AgeText {
  unknown: string;
  months: (months: number) => string;
  years: (years: number) => string;
  yearsAndMonths: (years: number, months: number) => string;
}

const AGE_TEXT: PortalCopy<AgeText> = {
  en: {
    unknown: 'Age unknown',
    months: (months) => `${months}mo`,
    years: (years) => `${years}yr`,
    yearsAndMonths: (years, months) => `${years}yr ${months}mo`,
  },
  zh: {
    unknown: '年龄未知',
    months: (months) => `${months}个月`,
    years: (years) => `${years}岁`,
    yearsAndMonths: (years, months) => `${years}岁${months}个月`,
  },
};

export function petAge(birthDate?: string | null, locale: PortalLocale = 'en'): string {
  const text = AGE_TEXT[locale];
  if (!birthDate) return text.unknown;
  const birth = new Date(birthDate);
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * MONTHS_PER_YEAR + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return text.unknown;
  const years = Math.floor(months / MONTHS_PER_YEAR);
  const remainder = months % MONTHS_PER_YEAR;
  if (years === 0) return text.months(remainder);
  if (remainder === 0) return text.years(years);
  return text.yearsAndMonths(years, remainder);
}

const SPECIES_LABELS: PortalCopy<Record<Species, string>> = {
  en: { DOG: 'Dog', CAT: 'Cat', OTHER: 'Pet' },
  zh: { DOG: '狗狗', CAT: '猫咪', OTHER: '宠物' },
};

/** The species in words, for when no breed is on file. The API sends the enum ('DOG'). */
export function speciesLabel(species: Species, locale: PortalLocale = 'en'): string {
  return SPECIES_LABELS[locale][species];
}

import type { SiteCopy, SiteLanguage } from '../i18n/siteLanguage';

/**
 * The reasons a manager can give for refusing a stay (owner decision of 2026-10-05: preset reasons
 * in English and Chinese rather than free text, so a Chinese reader never meets English). Hosting
 * sites do the same: a short list, and "contact us" for anything the list does not cover.
 *
 * The English sentence is what is stored in `booking_pets.refusal_reason`, so every reader of
 * that column keeps working; the pet parent pages turn it into the reader's language here.
 * Vaccinations are not a reason: a pet without proof still stays, kept apart (decision 5).
 */
export const REFUSAL_REASON_IDS = [
  'fully_booked',
  'medication',
  'health',
  'behaviour',
  'pet_type',
  'contact_us',
] as const;

export type RefusalReasonId = (typeof REFUSAL_REASON_IDS)[number];

export const REFUSAL_REASONS: SiteCopy<Record<RefusalReasonId, string>> = {
  en: {
    fully_booked: 'We are fully booked on those dates.',
    medication: 'We cannot give the medication this pet needs.',
    health: 'This pet needs more health care than we can safely give.',
    behaviour: 'We cannot safely care for this pet with other animals.',
    pet_type: 'We cannot take this kind of pet.',
    contact_us: 'Please contact us and we will explain.',
  },
  zh: {
    fully_booked: '那几天已经住满了。',
    medication: '我们无法提供这只宠物需要的用药照护。',
    health: '这只宠物需要的健康照护超出了我们能安全提供的范围。',
    behaviour: '我们无法让这只宠物和其他动物一起安全地住宿。',
    pet_type: '我们无法接收这类宠物。',
    contact_us: '请联系我们，我们会向你说明原因。',
  },
};

/**
 * A stored reason in the reader's language. English is shown as stored. In Chinese a preset is
 * translated; words a manager typed before the presets existed have no translation, so the
 * answer is null and the page says so in its own words.
 */
export const refusalReasonIn = (stored: string, language: SiteLanguage): string | null => {
  if (language === 'en') return stored;
  const wanted = stored.trim();
  const id = REFUSAL_REASON_IDS.find((reason) => REFUSAL_REASONS.en[reason] === wanted);
  return id ? REFUSAL_REASONS.zh[id] : null;
};

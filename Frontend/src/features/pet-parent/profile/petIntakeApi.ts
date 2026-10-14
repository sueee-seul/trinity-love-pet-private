import { API_BASE_URL } from '../../../shared/api';
import { currentPortalLocale, type PortalLocale } from '../i18n/portalLocale';

/**
 * A draft of the pet form, read out of something the owner wrote.
 *
 * Every field is optional: the server returns only what the description actually stated, so a
 * missing key means "not mentioned" rather than "cleared". The form merges what is here over what
 * the owner has already typed and leaves the rest alone.
 */
export interface PetIntakeMedication {
  name: string;
  strength?: string | null;
  dose?: number | null;
  unit?: string | null;
  route?: string | null;
  schedule?: string[] | null;
  withFood?: boolean | null;
  instructions?: string | null;
  prescribedBy?: string | null;
}

export interface PetIntakeDraft {
  name?: string;
  species?: 'DOG' | 'CAT' | 'OTHER';
  breed?: string;
  birthDate?: string;
  sex?: 'male' | 'female';
  desexed?: boolean;
  weightKg?: number;
  colour?: string;
  microchip?: string;
  dietNotes?: string;
  allergies?: string[];
  behaviourNotes?: string;
  vetName?: string;
  vetPhone?: string;
  emergencyContact?: string;
  medications?: PetIntakeMedication[];
}

/**
 * The free-text values in the language the owner reads, so they can check what was understood;
 * the form keeps the English, which staff read. Sent only when the page is in Chinese.
 */
export interface PetIntakeReadBack {
  breed: string | null;
  colour: string | null;
  dietNotes: string | null;
  allergies: string[] | null;
  behaviourNotes: string | null;
  /** One per medication, in the draft's order. */
  medicationInstructions: (string | null)[] | null;
}

export interface PetIntakeResult {
  draft: PetIntakeDraft;
  readBack: PetIntakeReadBack | null;
  /**
   * The language the owner wrote or spoke in, named in English, or null when the model would not
   * commit to one. Shown back to them so a translated draft says it was translated.
   */
  sourceLanguage: string | null;
}

export const readPetDescription = async (
  description: string,
  locale: PortalLocale = currentPortalLocale(),
): Promise<PetIntakeResult> => {
  const response = await fetch(`${API_BASE_URL}/ai/pet-description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ description, locale }),
  });

  const body = (await response.json()) as {
    msg?: string;
    data?: {
      draft?: PetIntakeDraft;
      sourceLanguage?: string | null;
      readBack?: PetIntakeReadBack | null;
    };
  };

  if (!response.ok) {
    throw new Error(body.msg ?? 'Could not read the description.');
  }

  return {
    draft: body.data?.draft ?? {},
    sourceLanguage: body.data?.sourceLanguage ?? null,
    readBack: body.data?.readBack ?? null,
  };
};

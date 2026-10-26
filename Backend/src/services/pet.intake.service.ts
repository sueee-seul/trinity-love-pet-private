import { generateObject } from 'ai';
import { z } from 'zod';
import { createToolModel } from './llm.service.js';
import { removeDashes } from '../common/utils/plain-punctuation.js';

/**
 * Turns a sentence a pet parent types into the fields the pet form already has.
 *
 * The product is asking parents for more and more about their animal (vet, microchip, allergies,
 * every medication with its dose and schedule), and a long form is where people give up. This lets
 * them write it the way they would say it and then check what was understood.
 *
 * Two rules shape everything below:
 *
 * 1. **Nothing is saved by this.** It returns a draft. The parent sees every field, edits what is
 *    wrong, and submits the existing form. A model filling in a pet's medication unattended is not
 *    a feature anyone should ship.
 * 2. **Absent beats guessed.** Every field is optional and the model is told to leave out whatever
 *    was not actually said. A blank the parent fills in is a small cost; an invented microchip
 *    number or a wrong dose is not.
 */

const speciesSchema = z.enum(['DOG', 'CAT', 'OTHER']);
const sexSchema = z.enum(['male', 'female']);

const medicationSchema = z
  .object({
    name: z.string().min(1).describe('Medication name as written, e.g. "Apoquel"'),
    strength: z.string().nullable().describe('Strength if stated, e.g. "16mg"'),
    dose: z.number().positive().nullable().describe('How many units per administration'),
    unit: z.string().nullable().describe('tablet, ml, capsule, sachet'),
    route: z.string().nullable().describe('ORAL, TOPICAL, INJECTION'),
    schedule: z
      .array(z.string())
      .nullable()
      .describe('One entry per daily administration time, e.g. ["morning", "evening"]'),
    withFood: z.boolean().nullable(),
    instructions: z.string().nullable(),
    prescribedBy: z.string().nullable(),
  })
  .strict();

/**
 * The free-text values again, in the language the owner reads the page in, so they can check what
 * was understood. The form keeps the English, which staff read; an owner cannot confirm an allergy
 * or a dose written in a language they do not read. Reading a translation back in the source
 * language is how medical translation is checked (back-translation).
 */
const readBackSchema = z
  .object({
    breed: z.string().nullable(),
    colour: z.string().nullable(),
    dietNotes: z.string().nullable(),
    allergies: z.array(z.string()).nullable().describe('One entry per allergen, same order'),
    behaviourNotes: z.string().nullable(),
    medicationInstructions: z
      .array(z.string().nullable())
      .nullable()
      .describe('One entry per medication, same order; null where it has no instructions'),
  })
  .strict();

export type PetIntakeReadBack = z.infer<typeof readBackSchema>;

/** The language the owner reads the page in. */
export type IntakeReaderLanguage = 'en' | 'zh';

/**
 * Every field is `.nullable()` rather than `.optional()`.
 *
 * OpenAI's structured outputs run the schema in strict mode, which requires every key in
 * `properties` to also appear in `required`: an optional key is rejected outright with
 * "'required' is required to be supplied and to be an array including every key in properties".
 * Required-but-nullable satisfies that while keeping the behaviour we want: the model answers
 * `null` for anything the owner did not mention, and `stripEmpty` drops it before it reaches the
 * form.
 *
 * Mirrors `PetFormInput` on the client. Anything added here has to exist on the form, or the parent
 * would be shown something they cannot check or correct.
 */
export const petIntakeSchema = z
  .object({
    /**
     * Not a form field. It is returned so the owner can be told what was read and what was
     * translated, which is the difference between a form that quietly rewrote their words and one
     * that says it did. Split off from the draft before it reaches the client.
     */
    sourceLanguage: z
      .string()
      .nullable()
      .describe('The language the owner wrote in, named in English, e.g. "Chinese", "Spanish"'),
    name: z.string().nullable().describe("The animal's name, not the owner's"),
    species: speciesSchema.nullable(),
    breed: z.string().nullable(),
    birthDate: z
      .string()
      .nullable()
      .describe('ISO YYYY-MM-DD. Only if an actual date is given, never derived from an age'),
    sex: sexSchema.nullable(),
    desexed: z.boolean().nullable().describe('Only when desexed, neutered or spayed is stated'),
    weightKg: z.number().positive().nullable(),
    colour: z.string().nullable(),
    microchip: z.string().nullable().describe('Only a number actually given; never invent one'),
    dietNotes: z.string().nullable(),
    allergies: z.array(z.string()).nullable().describe('One entry per allergen'),
    behaviourNotes: z
      .string()
      .nullable()
      .describe('Temperament, fears, how they are with other animals'),
    vetName: z.string().nullable(),
    vetPhone: z.string().nullable(),
    emergencyContact: z.string().nullable(),
    medications: z.array(medicationSchema).nullable(),
    /** Not a form field: the read-back for an owner who reads Chinese, null otherwise. */
    readBack: readBackSchema.nullable(),
  })
  .strict();

type PetIntakeExtraction = z.infer<typeof petIntakeSchema>;
type PetIntakeMedication = z.infer<typeof medicationSchema>;

/** The form fields only. `sourceLanguage` and `readBack` are reported beside this. */
export type PetIntakeDraft = Omit<PetIntakeExtraction, 'sourceLanguage' | 'readBack'>;

export interface PetIntakeResult {
  draft: PetIntakeDraft;
  /** Named in English, or null when the model would not commit to one. */
  sourceLanguage: string | null;
  /** The free-text values in Chinese for an owner who reads Chinese; null otherwise. */
  readBack: PetIntakeReadBack | null;
}

export const MAX_INTAKE_LENGTH = 4000;
/**
 * Short on purpose: "the weight is 30 kg" in Chinese (seven characters) is a whole fact in Chinese, and a ten-letter
 * floor written with English in mind refused it.
 */
export const MIN_INTAKE_LENGTH = 2;

export class PetIntakeError extends Error {
  public readonly code = 'PET_INTAKE_FAILED';
}

const SYSTEM_PROMPT = [
  'You extract pet details from what an owner wrote, for a boarding facility intake form.',
  '',
  'Extract only what the text actually states.',
  '- Omit any field that was not mentioned. An omitted field is correct; a guessed one is not.',
  '- Never invent a microchip number, a phone number, a date of birth or a dose.',
  '- An age in years is not a birth date. Leave birthDate out unless a date is given.',
  "- Keep the owner's own words for notes; do not summarise them into advice.",
  '- "desexed", "neutered", "spayed", "fixed" all mean desexed is true.',
  '- Weight must be in kilograms. Convert pounds if the owner used them.',
  '',
  'The owner may write in any language. Every value you return must be in English.',
  '- Translate breed, colour, allergies, diet notes, behaviour notes and medication instructions',
  '  into English. Staff read this form to care for the animal; a note they cannot read is worse',
  '  than no note.',
  '- Do NOT translate names. The pet name and the vet name stay exactly as the owner wrote them,',
  '  in their original script. Staff call the animal by its name, and a translated one is a',
  '  different animal to everyone involved.',
  "- Keep a medication's brand name as written. Translating a drug name invents a new drug.",
  '- Report which language the owner wrote in as sourceLanguage, named in English. Use "English"',
  '  when they wrote in English.',
  '',
  'Use plain punctuation in notes and instructions. Never use em dashes or en dashes.',
].join('\n');

/** Asks for the read-back only when the owner reads Chinese. */
const readBackRule = (readerLanguage: IntakeReaderLanguage): string =>
  readerLanguage === 'zh'
    ? [
        '',
        'The owner reads Simplified Chinese. Also fill readBack: the breed, colour, diet notes,',
        'allergies, behaviour notes and medication instructions you returned, each written in',
        'Simplified Chinese so the owner can check them. Keep names and drug names as written.',
        'Leave a readBack value null when its English value is absent.',
      ].join('\n')
    : '\nSet readBack to null.';

/**
 * Empty fields are stripped before returning. The client merges this over the current form, so a
 * key that is present but null would blank out something the parent had already typed.
 */
const stripEmpty = (draft: Record<string, unknown>): PetIntakeDraft => {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(draft)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    cleaned[key] = value;
  }

  return cleaned as PetIntakeDraft;
};

type PetIntakeFields = Partial<PetIntakeDraft>;

const removeDashesFromMedication = (medication: PetIntakeMedication): PetIntakeMedication =>
  medication.instructions
    ? { ...medication, instructions: removeDashes(medication.instructions) }
    : medication;

/**
 * The notes and instructions are sentences the model wrote, often as a translation, and the parent
 * reads them in the form, so they get plain punctuation. Names, numbers and phone numbers stay
 * exactly as written. A field that is absent stays absent, so nothing new reaches the form.
 */
const removeDashesFromNotes = (fields: PetIntakeFields): PetIntakeFields => ({
  ...fields,
  ...(fields.dietNotes ? { dietNotes: removeDashes(fields.dietNotes) } : {}),
  ...(fields.behaviourNotes ? { behaviourNotes: removeDashes(fields.behaviourNotes) } : {}),
  ...(fields.medications
    ? { medications: fields.medications.map(removeDashesFromMedication) }
    : {}),
});

export const extractPetDetails = async (
  description: string,
  readerLanguage: IntakeReaderLanguage = 'en',
): Promise<PetIntakeResult> => {
  try {
    const { object } = await generateObject({
      model: createToolModel(),
      schema: petIntakeSchema,
      system: SYSTEM_PROMPT + readBackRule(readerLanguage),
      prompt: description,
      // Kept for the Ollama path, which this project defaults to and where it does make the
      // extraction deterministic. A reasoning model ignores it and logs a warning; that is the
      // provider telling us so, not a setting to delete.
      temperature: 0,
    });

    // Separated rather than stripped: the draft is merged into the form field by field, and a
    // `sourceLanguage` key riding along would be one the form has no place to put.
    const { sourceLanguage = null, readBack = null, ...fields } = object ?? {};

    return {
      draft: stripEmpty(removeDashesFromNotes(fields)),
      sourceLanguage: sourceLanguage || null,
      readBack: readerLanguage === 'zh' ? readBack : null,
    };
  } catch (cause) {
    throw new PetIntakeError('Could not read the description.', { cause });
  }
};

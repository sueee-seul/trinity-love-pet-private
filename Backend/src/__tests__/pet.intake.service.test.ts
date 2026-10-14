import { describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();

vi.mock('ai', () => ({ generateObject: generateObjectMock }));
vi.mock('../services/llm.service.js', () => ({ createToolModel: (): string => 'test-model' }));

const { extractPetDetails, PetIntakeError, petIntakeSchema } =
  await import('../services/pet.intake.service.js');

describe('extractPetDetails', () => {
  it('keeps only the fields the description actually mentioned', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        name: 'Mochi',
        species: 'DOG',
        breed: null,
        birthDate: null,
        sex: 'female',
        desexed: true,
        weightKg: 18,
        colour: null,
        microchip: null,
        dietNotes: null,
        allergies: ['chicken'],
        behaviourNotes: null,
        vetName: null,
        vetPhone: null,
        emergencyContact: null,
        medications: null,
      },
    });

    await expect(
      extractPetDetails('Mochi, desexed female dog, 18kg, allergic to chicken'),
    ).resolves.toEqual({
      draft: {
        name: 'Mochi',
        species: 'DOG',
        sex: 'female',
        desexed: true,
        weightKg: 18,
        allergies: ['chicken'],
      },
      sourceLanguage: null,
      readBack: null,
    });
  });

  /*
   * The owner may write in any language and the form is English, so values are translated. The
   * language is reported beside the draft rather than inside it: the form has no field for it, and
   * a key it cannot place would be merged into nothing.
   */
  it('reports the source language separately from the form fields', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        sourceLanguage: 'Chinese',
        name: '小白',
        breed: 'Border Collie',
        allergies: ['chicken'],
        desexed: false,
      },
    });

    await expect(extractPetDetails('小白是一只边境牧羊犬，还没绝育，对鸡肉过敏')).resolves.toEqual({
      draft: { name: '小白', breed: 'Border Collie', allergies: ['chicken'], desexed: false },
      sourceLanguage: 'Chinese',
      readBack: null,
    });
  });

  /*
   * A key that is present but empty would blank out something the owner had already typed, because
   * the form merges this over its current state.
   */
  // The form stays English for staff; an owner who reads Chinese also gets the values to check.
  it('reads the free text back in Chinese for an owner who reads Chinese', async () => {
    const readBack = {
      breed: '边境牧羊犬',
      colour: null,
      dietNotes: null,
      allergies: ['鸡肉'],
      behaviourNotes: null,
      medicationInstructions: null,
    };
    generateObjectMock.mockResolvedValue({
      object: {
        sourceLanguage: 'Chinese',
        breed: 'Border Collie',
        allergies: ['chicken'],
        readBack,
      },
    });

    await expect(
      extractPetDetails('小白是一只边境牧羊犬，对鸡肉过敏', 'zh'),
    ).resolves.toMatchObject({ draft: { breed: 'Border Collie' }, readBack });
    const request = generateObjectMock.mock.calls.at(-1)?.[0] as { system: string };
    expect(request.system).toContain('The owner reads Simplified Chinese. Also fill readBack');
  });

  it('drops empty strings and empty arrays as well as nulls', async () => {
    generateObjectMock.mockResolvedValue({
      object: { name: 'Rex', breed: '', allergies: [], colour: null },
    });

    await expect(extractPetDetails('a dog called Rex')).resolves.toEqual({
      draft: { name: 'Rex' },
      sourceLanguage: null,
      readBack: null,
    });
  });

  it('keeps false, which is an answer rather than a blank', async () => {
    generateObjectMock.mockResolvedValue({ object: { name: 'Rex', desexed: false } });

    await expect(extractPetDetails('Rex is not desexed')).resolves.toEqual({
      draft: { name: 'Rex', desexed: false },
      sourceLanguage: null,
      readBack: null,
    });
  });

  it('removes dashes from the notes the model wrote but not from names or numbers', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        name: 'Mochi',
        vetPhone: '09\u2013555\u20130180',
        dietNotes: 'Wet food twice a day \u2014 no chicken.',
        behaviourNotes: 'Shy at first\u2014\u2014warms up quickly.',
        medications: [
          {
            name: 'Apoquel',
            strength: '16mg',
            dose: 1,
            unit: 'tablet',
            route: 'ORAL',
            schedule: ['morning'],
            withFood: true,
            instructions: 'Give with food \u2014 never on an empty stomach.',
            prescribedBy: null,
          },
        ],
      },
    });

    const { draft } = await extractPetDetails('Mochi eats wet food and takes Apoquel');

    expect(draft).toMatchObject({
      name: 'Mochi',
      vetPhone: '09\u2013555\u20130180',
      dietNotes: 'Wet food twice a day, no chicken.',
      behaviourNotes: 'Shy at first, warms up quickly.',
      medications: [{ instructions: 'Give with food, never on an empty stomach.' }],
    });
  });

  it('reports a provider failure without leaking it', async () => {
    generateObjectMock.mockRejectedValue(new Error('401 invalid api key'));

    await expect(extractPetDetails('anything')).rejects.toBeInstanceOf(PetIntakeError);
  });

  /*
   * OpenAI runs structured outputs in strict mode, which rejects a schema where any key in
   * `properties` is missing from `required`. Optional fields produce exactly that, and the whole
   * feature failed on it, so the shape is asserted rather than left to be rediscovered.
   */
  it('declares every field required-but-nullable, which strict mode demands', () => {
    const json = JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (petIntakeSchema as any).toJSONSchema?.() ?? {},
    );
    const shape = petIntakeSchema.shape;

    for (const [key, field] of Object.entries(shape)) {
      expect(field.safeParse(null).success, `${key} must accept null`).toBe(true);
      expect(field.isOptional(), `${key} must not be optional`).toBe(false);
    }

    expect(typeof json).toBe('string');
  });
});

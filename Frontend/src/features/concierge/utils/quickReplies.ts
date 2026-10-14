import type { ConciergeCopy } from '../copy';
import type {
  ConciergeNeedField,
  ConciergeNeeds,
  ConciergePetSize,
  ConciergePlan,
  ConciergeSpecies,
} from '../types';
import { dateProblem } from './format';
import { withMedicationFor, withPet, withPetSpecies } from './needsEdit';

/**
 * The answer buttons under the assistant's latest message.
 *
 * Code picks them from what is still missing (never the model), and each one is a structured
 * change to the needs, so nothing can be misread and they work the same when the assistant is in
 * basic mode or down. Most guests get a priced quote in about five taps with no typing.
 */

export type QuickReply =
  | {
      kind: 'answer';
      id: string;
      label: string;
      /** What the guest "said", shown as their chat bubble and sent as the turn's message. */
      message: string;
      apply: (needs: ConciergeNeeds) => ConciergeNeeds;
    }
  | { kind: 'dates'; id: string; label: string }
  | { kind: 'checklist'; id: string; label: string }
  | { kind: 'person'; id: string; label: string }
  /** Opens the stay panel with the suggested stays. */
  | { kind: 'options'; id: string; label: string }
  /** Sent as a typed message, so the assistant hears it (the book-it hand-off). */
  | { kind: 'say'; id: string; label: string; message: string };

export interface QuickReplyGroup {
  /** Names the group for screen readers, e.g. "Pet 2 size". */
  label: string;
  replies: QuickReply[];
}

export interface QuickReplyInput {
  copy: ConciergeCopy;
  needs: ConciergeNeeds;
  missingFields: ConciergeNeedField[];
  /** How many suggested stays are on offer; the stay panel opens once there are any. */
  comboCount: number;
  /** True before the guest has sent or tapped anything. */
  isFirstTurn: boolean;
  /** A signed-in parent with an earlier stay to copy; a guest never has one. */
  hasLastStay?: boolean;
  today: string;
  /** The assistant's recommendation, once the options are ready. */
  plan?: ConciergePlan | null;
}

const SPECIES: ConciergeSpecies[] = ['dog', 'cat', 'other'];
const SIZES: ConciergePetSize[] = ['small', 'medium', 'large'];

const startersFor = (copy: ConciergeCopy, hasLastStay: boolean): QuickReplyGroup => ({
  label: copy.answers.groupLabel,
  replies: [
    // The fastest path for a returning parent: the server copies the pets and services, and only
    // the dates are asked.
    ...(hasLastStay
      ? [
          {
            kind: 'say' as const,
            id: 'same-as-last-time',
            label: copy.answers.sameAsLastTime,
            message: copy.answers.sameAsLastTime,
          },
        ]
      : []),
    {
      kind: 'answer',
      id: 'start-dog',
      label: copy.answers.starterDog,
      message: copy.answers.starterDog,
      apply: (needs) => withPetSpecies(needs, ['dog']),
    },
    {
      kind: 'answer',
      id: 'start-cat',
      label: copy.answers.starterCat,
      message: copy.answers.starterCat,
      apply: (needs) => withPetSpecies(needs, ['cat']),
    },
    { kind: 'checklist', id: 'start-several', label: copy.answers.starterSeveral },
    { kind: 'person', id: 'start-person', label: copy.talkToPerson },
  ],
});

const petCountReplies = (copy: ConciergeCopy): QuickReplyGroup => {
  const { answers } = copy;
  const counts: Array<{ species: 'dog' | 'cat'; count: number }> = [
    { species: 'dog', count: 1 },
    { species: 'dog', count: 2 },
    { species: 'cat', count: 1 },
    { species: 'cat', count: 2 },
  ];
  return {
    label: copy.checklist.petCount,
    replies: [
      ...counts.map(({ species, count }): QuickReply => ({
        kind: 'answer',
        id: `pets-${count}-${species}`,
        label: answers.petCount(count, species),
        message:
          species === 'dog' ? answers.chipMessage.dogs(count) : answers.chipMessage.cats(count),
        apply: (needs) =>
          withPetSpecies(
            needs,
            Array.from({ length: count }, () => species),
          ),
      })),
      {
        kind: 'answer',
        id: 'pets-dog-cat',
        label: answers.dogAndCat,
        message: answers.chipMessage.dogAndCat,
        apply: (needs) => withPetSpecies(needs, ['dog', 'cat']),
      },
      { kind: 'checklist', id: 'pets-other', label: answers.somethingElse },
    ],
  };
};

const speciesReplies = (copy: ConciergeCopy, index: number): QuickReplyGroup => ({
  label: copy.answers.speciesFor(index),
  replies: SPECIES.map((species) => ({
    kind: 'answer',
    id: `species-${index}-${species}`,
    label: copy.checklist[species],
    message: copy.answers.chipMessage.species(index, copy.checklist[species]),
    apply: (needs) => withPet(needs, index, { species, size: null }),
  })),
});

const sizeReplies = (copy: ConciergeCopy, index: number): QuickReplyGroup => ({
  label: copy.answers.sizeFor(index),
  replies: SIZES.map((size) => ({
    kind: 'answer',
    id: `size-${index}-${size}`,
    label: copy.checklist[size],
    message: copy.answers.chipMessage.size(index, copy.checklist[size]),
    apply: (needs) => withPet(needs, index, { size }),
  })),
});

/**
 * The medication question, about the pets nobody has answered for yet. A saved pet can arrive
 * with its medication on record, so the others are still asked about ("anyone else"), and no
 * answer here changes a pet that already has one. Null when every pet has an answer.
 */
const medicationQuestion = (copy: ConciergeCopy, needs: ConciergeNeeds): QuickReplyGroup | null => {
  const { answers } = copy;
  const asked = needs.pets.flatMap((pet, index) => (pet.needsMedication === null ? [index] : []));
  if (asked.length === 0) return null;
  const answer = (id: string, label: string, message: string, taking: number[]): QuickReply => ({
    kind: 'answer',
    id,
    label,
    message,
    apply: (current) => withMedicationFor(current, asked, taking),
  });
  const wording =
    asked.length < needs.pets.length
      ? {
          question: answers.medicationQuestionOthers,
          none: answers.noOtherMedication,
          noneSaid: answers.chipMessage.noOtherMedication,
          all: answers.othersTakeMedication,
          allSaid: answers.chipMessage.othersMedication,
        }
      : {
          question: answers.medicationQuestion,
          none: answers.noMedication,
          noneSaid: answers.chipMessage.noMedication,
          all: answers.allTakeMedication,
          allSaid: answers.chipMessage.allMedication,
        };
  const none = answer('medication-none', wording.none, wording.noneSaid, []);
  if (needs.pets.length === 1) {
    // One pet on its own gets a plain yes.
    const yes = answer(
      'medication-all',
      copy.checklist.medication,
      answers.chipMessage.medication(0),
      asked,
    );
    return { label: wording.question, replies: [none, yes] };
  }
  const perPet = asked.map((index) =>
    answer(
      `medication-${index}`,
      answers.petTakesMedication(index),
      answers.chipMessage.medication(index),
      [index],
    ),
  );
  const all =
    asked.length > 1 ? [answer('medication-all', wording.all, wording.allSaid, asked)] : [];
  return { label: wording.question, replies: [none, ...perPet, ...all] };
};

export const buildQuickReplies = ({
  copy,
  needs,
  missingFields,
  comboCount,
  isFirstTurn,
  hasLastStay = false,
  today,
  plan = null,
}: QuickReplyInput): QuickReplyGroup | null => {
  if (isFirstTurn && needs.pets.length === 0) return startersFor(copy, hasLastStay);

  const [next] = missingFields;
  if (next === 'service') {
    return {
      label: copy.answers.groupLabel,
      replies: [
        {
          kind: 'answer',
          id: 'service-boarding',
          label: copy.answers.boardingYes,
          message: copy.answers.boardingYes,
          apply: (current) => ({ ...current, service: 'boarding' }),
        },
        { kind: 'person', id: 'service-other', label: copy.answers.somethingElse },
      ],
    };
  }
  if (next === 'dates' || dateProblem(needs.startDate, needs.endDate, today)) {
    return {
      label: copy.answers.chooseDates,
      replies: [{ kind: 'dates', id: 'dates', label: copy.answers.chooseDates }],
    };
  }
  if (next === 'pets') return petCountReplies(copy);
  if (next === 'species') {
    const index = needs.pets.findIndex((pet) => pet.species === null);
    return speciesReplies(copy, Math.max(index, 0));
  }
  if (missingFields.length > 0) return null;

  // Ready: offer the details that help staff but never hold the price back, then the stay.
  const seeOptions: QuickReply = {
    kind: 'options',
    id: 'see-options',
    label: copy.answers.seeOptions,
  };
  // With a recommendation on screen, one tap hands the form-filling to the assistant.
  const bookForMe: QuickReply[] =
    comboCount > 0 && plan?.recommendedComboId && !plan.bookRequested
      ? [
          {
            kind: 'say',
            id: 'book-for-me',
            label: copy.answers.bookForMe,
            message: copy.answers.bookForMe,
          },
        ]
      : [];
  const withOptions = (group: QuickReplyGroup): QuickReplyGroup =>
    comboCount > 0 ? { ...group, replies: [...group.replies, seeOptions, ...bookForMe] } : group;
  const unsizedDog = needs.pets.findIndex((pet) => pet.species === 'dog' && pet.size === null);
  const medication = medicationQuestion(copy, needs);
  // With several pets the medication question comes first: it changes the price, size does not,
  // and it is what the assistant asks when it cannot tell which pet a guest meant.
  if (medication && needs.pets.length > 1) return withOptions(medication);
  if (unsizedDog !== -1) return withOptions(sizeReplies(copy, unsizedDog));
  if (medication) return withOptions(medication);
  return comboCount > 0
    ? { label: copy.answers.groupLabel, replies: [seeOptions, ...bookForMe] }
    : null;
};

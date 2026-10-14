import { describe, expect, it } from 'vitest';
import { CONCIERGE_COPY } from '../copy';
import { createEmptyNeeds } from '../store/conciergeStore';
import type { ConciergeNeeds, ConciergePetNeed } from '../types';
import { buildQuickReplies, type QuickReplyGroup } from '../utils/quickReplies';

/**
 * A saved pet can arrive with its medication on record. The medication question then still asks
 * about every other pet, and never changes the answer the account already gave.
 */

const sizedDog = (needsMedication: boolean | null): ConciergePetNeed => ({
  species: 'dog',
  size: 'medium',
  needsMedication,
  firstTimeBoarding: null,
});

const questionFor = (pets: ConciergePetNeed[]): QuickReplyGroup | null =>
  buildQuickReplies({
    copy: CONCIERGE_COPY.en,
    needs: { ...createEmptyNeeds(), service: 'boarding', pets },
    missingFields: [],
    comboCount: 2,
    isFirstTurn: false,
    today: '2026-09-28',
  });

const medicationAfter = (
  group: QuickReplyGroup | null,
  label: string,
  needs: ConciergeNeeds,
): Array<boolean | null> => {
  const reply = group?.replies.find((candidate) => candidate.label === label);
  if (reply?.kind !== 'answer') throw new Error(`No answer labelled ${label}`);
  return reply.apply(needs).pets.map((pet) => pet.needsMedication);
};

describe('the medication question with a saved pet on record', () => {
  const maxOnRecordRexUnknown = [sizedDog(true), sizedDog(null)];
  const needs: ConciergeNeeds = {
    ...createEmptyNeeds(),
    service: 'boarding',
    pets: maxOnRecordRexUnknown,
  };

  it('still asks about the pet nobody has answered for', () => {
    const group = questionFor(maxOnRecordRexUnknown);

    expect(group?.label).toBe('Does anyone else take medication?');
    expect(group?.replies.map((reply) => reply.label)).toEqual([
      'No one else',
      'Pet 2 does',
      'Open my stay',
    ]);
  });

  it('answers only for that pet and keeps the answer on record', () => {
    const group = questionFor(maxOnRecordRexUnknown);

    expect(medicationAfter(group, 'No one else', needs)).toEqual([true, false]);
    expect(medicationAfter(group, 'Pet 2 does', needs)).toEqual([true, true]);
  });

  it('offers all the others when more than one pet is unanswered', () => {
    const pets = [sizedDog(true), sizedDog(null), sizedDog(null)];
    const group = questionFor(pets);

    expect(group?.replies.map((reply) => reply.label)).toEqual([
      'No one else',
      'Pet 2 does',
      'Pet 3 does',
      'All the others',
      'Open my stay',
    ]);
    const threeDogs: ConciergeNeeds = { ...needs, pets };
    expect(medicationAfter(group, 'Pet 3 does', threeDogs)).toEqual([true, false, true]);
    expect(medicationAfter(group, 'All the others', threeDogs)).toEqual([true, true, true]);
  });

  it('stops asking once every pet has an answer', () => {
    expect(
      questionFor([sizedDog(true), sizedDog(false)])?.replies.map((reply) => reply.label),
    ).toEqual(['Open my stay']);
  });
});

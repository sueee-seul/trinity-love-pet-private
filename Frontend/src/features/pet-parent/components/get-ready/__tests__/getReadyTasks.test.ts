import { describe, expect, it } from 'vitest';
import type { GetReadyTask } from '../../../types/getReady';
import {
  dropOffChecks,
  getReadyButtonLabel,
  getReadyProgress,
  getReadyTaskViews,
  hasOpenTasks,
} from '../getReadyTasks';

const TARGET = { bookingPetId: 'bp-max', petId: 'pet-max', petName: 'Max' };

const tasks: GetReadyTask[] = [
  { key: 'vaccination', status: 'not_started' },
  { key: 'feeding', status: 'completed' },
  { key: 'medication', status: 'completed' },
  { key: 'emergency_contact_and_vet', status: 'not_started' },
];

describe('getReadyTaskViews', () => {
  it('names each task in sentence case and keeps the order the server sent', () => {
    expect(getReadyTaskViews(tasks, TARGET).map((task) => task.label)).toEqual([
      'Vaccination proof',
      'Feeding',
      'Medication',
      'Emergency contact and vet',
    ]);
  });

  it("links the vaccination proof to this stay and every other task to the pet's page", () => {
    expect(getReadyTaskViews(tasks, TARGET).map((task) => task.to)).toEqual([
      '/parent/vaccination/bp-max',
      '/parent/pets/pet-max',
      '/parent/pets/pet-max',
      '/parent/pets/pet-max',
    ]);
  });

  it('links nothing but the stay itself once the pet profile was deleted', () => {
    const withoutProfile = { ...TARGET, petId: null };
    expect(getReadyTaskViews(tasks, withoutProfile).map((task) => task.to)).toEqual([
      '/parent/vaccination/bp-max',
      null,
      null,
      null,
    ]);
  });

  it('gives an open medication task to our team, with no link, since parents cannot record medicines', () => {
    const medicationOpen: GetReadyTask[] = [{ key: 'medication', status: 'not_started' }];
    expect(getReadyTaskViews(medicationOpen, TARGET)).toEqual([
      {
        key: 'medication',
        label: 'Medication',
        hint: "Our team will go through Max's medicines, doses and times with you by check-in.",
        to: null,
        status: 'not_started',
      },
    ]);
  });

  it("keeps a finished medication task linked to the pet's page", () => {
    expect(getReadyTaskViews(tasks, TARGET)[2]).toMatchObject({
      hint: 'Any medicines Max takes, and how to give them.',
      to: '/parent/pets/pet-max',
    });
  });

  it('asks for the dates the Code of Welfare looks for on the certificate', () => {
    expect(getReadyTaskViews(tasks, TARGET)[0]?.hint).toBe(
      'A certificate that shows the date given and the next due date.',
    );
  });
});

describe('the count', () => {
  it('counts completed tasks out of all of them', () => {
    expect(getReadyProgress(tasks)).toBe('2 of 4 done');
    expect(getReadyButtonLabel(tasks)).toBe('Get ready, 2 of 4 done');
    expect(hasOpenTasks(tasks)).toBe(true);
  });

  it('knows when nothing is left', () => {
    const done = tasks.map((task) => ({ ...task, status: 'completed' as const }));
    expect(getReadyProgress(done)).toBe('4 of 4 done');
    expect(hasOpenTasks(done)).toBe(false);
  });
});

describe('dropOffChecks', () => {
  it('says staff check the recorded vet consent and handles older bookings', () => {
    expect(dropOffChecks('Max')).toEqual([
      "Our staff check Max's vaccination proof and give Max a health check.",
      "Our staff go through Max's temperament and any bite history with you.",
      'Without proof, Max is kept apart from other pets until the vaccination status is known.',
      'Our team checks your recorded emergency vet consent. Current online bookings include consent up to NZ$500; older bookings may need a signature.',
    ]);
  });

  it('never calls a Wagstay rule the law', () => {
    expect(dropOffChecks('Max').join(' ')).not.toMatch(/\blaw\b|legal/i);
  });
});

describe('get ready words in Chinese', () => {
  it('labels the tasks and their hints in Chinese, with the same links', () => {
    const views = getReadyTaskViews(tasks, TARGET, 'zh');
    expect(views.map((task) => task.label)).toEqual([
      '疫苗证明',
      '饮食',
      '用药',
      '紧急联系人和兽医',
    ]);
    expect(views[1]?.hint).toBe('Max 吃什么、吃多少、什么时候吃。');
    expect(views.map((task) => task.to)).toEqual(
      getReadyTaskViews(tasks, TARGET).map((task) => task.to),
    );
  });

  it('counts the progress and writes the My stays button in Chinese', () => {
    expect(getReadyProgress(tasks, 'zh')).toBe('已完成 2/4');
    expect(getReadyButtonLabel(tasks, 'zh')).toBe('入住准备，已完成 2/4');
  });

  it('lists the four check-in checks in Chinese', () => {
    const checks = dropOffChecks('Max', 'zh');
    expect(checks).toHaveLength(4);
    expect(checks[0]).toBe('我们的工作人员会查看 Max 的疫苗证明，并给 Max 做健康检查。');
  });
});

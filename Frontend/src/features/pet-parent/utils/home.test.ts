import { describe, expect, it } from 'vitest';
import type { ChecklistItem, HomePet, UpcomingStay } from '../types/home';
import {
  bookHeroFor,
  checklistLink,
  daysToGoCompactLabel,
  daysToGoLabel,
  formatCompactRange,
  formatStayRange,
  greetingFor,
  joinNames,
  outstandingIssueLabel,
  petMeta,
  petMetaParts,
  pickUpLabel,
  prepareLink,
  quickActionsFor,
  quickActionsDuringStay,
  resolveQuickActions,
  upcomingTitle,
} from './home';

const max: HomePet = { id: '1', name: 'Max', species: 'dog', breed: 'Labrador', ageYears: 4 };
const luna: HomePet = { id: '2', name: 'Luna', species: 'cat', ageYears: 2 };

type ChecklistOverrides = Partial<Record<ChecklistItem['key'], Partial<ChecklistItem>>>;

const checklist = (overrides: ChecklistOverrides = {}): ChecklistItem[] =>
  (
    [
      { key: 'agreement', label: 'Agreement signed', status: 'done', tappable: false },
      { key: 'payment', label: 'Booking payment completed', status: 'done', tappable: false },
      {
        key: 'vaccination',
        label: 'Vaccination information',
        status: 'outstanding',
        tappable: true,
        bookingPetIds: ['bp-max'],
      },
      { key: 'admission', label: 'Admission verification', status: 'outstanding', tappable: false },
    ] as ChecklistItem[]
  ).map((item) => ({ ...item, ...overrides[item.key] }));

const itemOf = (key: ChecklistItem['key'], overrides: ChecklistOverrides = {}): ChecklistItem => {
  const found = checklist(overrides).find((item) => item.key === key);
  if (!found) throw new Error(`No checklist item ${key}`);
  return found;
};

const stay = (checklistItems = checklist()): UpcomingStay => ({
  bookingId: 'b1',
  confirmationNumber: 'PB-AAAAAA',
  status: 'approved',
  dropOffAt: new Date(2026, 8, 12).toISOString(),
  pickUpAt: new Date(2026, 8, 16).toISOString(),
  nights: 4,
  daysToGo: 5,
  serviceType: 'Overnight boarding',
  pets: [{ bookingPetId: 'bp-max', petId: '1', name: 'Max' }],
  checklist: checklistItems,
});

describe('names and meta', () => {
  it('joins names', () => {
    expect(joinNames(['Max'])).toBe('Max');
    expect(joinNames(['Max', 'Luna'])).toBe('Max and Luna');
    expect(joinNames(['Max', 'Luna', 'Rex'])).toBe('Max, Luna and Rex');
    expect(joinNames(['Max', 'Luna'], 'or')).toBe('Max or Luna');
  });

  it('describes a pet by breed (or species) and age', () => {
    expect(petMeta(max)).toBe('Labrador · 4\u00a0yrs');
    expect(petMeta(luna)).toBe('Cat · 2\u00a0yrs');
    expect(petMeta({ ...luna, ageYears: 1 })).toBe('Cat · 1\u00a0yr');
    expect(petMeta({ ...luna, ageYears: undefined })).toBe('Cat');
  });

  it('gives the breed and the age apart, for cards that put them on two lines', () => {
    expect(petMetaParts(max)).toEqual({ kind: 'Labrador', age: '4\u00a0yrs' });
    expect(petMetaParts({ ...luna, ageYears: undefined })).toEqual({ kind: 'Cat', age: null });
  });
});

describe('dates', () => {
  const a = new Date(2026, 8, 12).toISOString();
  it('formats stay ranges', () => {
    expect(formatStayRange(a, new Date(2026, 8, 16).toISOString())).toBe('12 Sep to 16 Sep');
    expect(formatCompactRange(a, new Date(2026, 8, 16).toISOString())).toBe('12 to 16 Sep');
    expect(
      formatCompactRange(new Date(2026, 8, 28).toISOString(), new Date(2026, 9, 2).toISOString()),
    ).toBe('28 Sep to 2 Oct');
  });

  it('labels days to go', () => {
    expect(daysToGoLabel(5)).toBe('5 days to go');
    expect(daysToGoLabel(1)).toBe('1 day to go');
    expect(daysToGoLabel(0)).toBe('Today');
  });

  it('labels days to go compactly, for the "Also coming up" rows', () => {
    expect(daysToGoCompactLabel(16)).toBe('16 days');
    expect(daysToGoCompactLabel(1)).toBe('1 day');
    expect(daysToGoCompactLabel(0)).toBe('Today');
  });

  it('labels the check-out of a stay under way', () => {
    expect(pickUpLabel(3)).toBe('Check-out in 3 days');
    expect(pickUpLabel(1)).toBe('Check-out tomorrow');
    expect(pickUpLabel(0)).toBe('Check-out today');
  });
});

describe('greetingFor', () => {
  it.each([
    ['A', 'Welcome, Phuong', "Let's get your pet ready for their first stay."],
    ['B1', 'Welcome back, Phuong', "Ready to plan your pet's first stay?"],
    ['B2', 'Welcome back, Phuong', "Ready for Max and Luna's next stay?"],
    ['C1', 'Welcome back, Phuong', null],
    ['C2', 'Welcome back, Phuong', null],
  ] as const)('%s', (state, title, subline) => {
    expect(greetingFor(state, 'Phuong', [max, luna])).toEqual({ title, subline });
  });

  it('drops the name when there is none', () => {
    expect(greetingFor('A', null, []).title).toBe('Welcome');
  });

  it('leaves the message to the hero while a stay is under way', () => {
    expect(greetingFor('B2', 'Phuong', [max, luna], true)).toEqual({
      title: 'Welcome back, Phuong',
      subline: null,
    });
  });
});

describe('hero copy', () => {
  it('B1 and B2 differ only in the wording the design specifies', () => {
    expect(bookHeroFor('B1', [max, luna])).toEqual({
      title: 'Book a stay',
      body: 'Choose your dates and services for Max or Luna.',
      showPastBookings: false,
    });
    expect(bookHeroFor('B2', [max, luna])).toMatchObject({
      title: 'Book another stay',
      showPastBookings: true,
    });
  });

  it('names every pet on the upcoming booking', () => {
    expect(upcomingTitle(stay())).toBe("Max's stay is coming up");
    const both = {
      ...stay(),
      pets: [...stay().pets, { bookingPetId: 'bp-luna', petId: '2', name: 'Luna' }],
    };
    expect(upcomingTitle(both)).toBe("Max and Luna's stay is coming up");
  });
});

describe('checklist links', () => {
  it('opens the first pet still missing a certificate', () => {
    expect(checklistLink(itemOf('vaccination'))).toBe('/parent/vaccination/bp-max');
  });

  it('has no link for done, non-tappable or admission items', () => {
    expect(checklistLink(itemOf('agreement'))).toBeNull();
    expect(checklistLink(itemOf('admission'))).toBeNull();
    expect(
      checklistLink(itemOf('vaccination', { vaccination: { status: 'done', tappable: false } })),
    ).toBeNull();
  });

  it('Prepare goes to the first outstanding item with somewhere to go', () => {
    expect(prepareLink(checklist())).toBe('/parent/vaccination/bp-max');
    expect(prepareLink(checklist({ vaccination: { status: 'done', tappable: false } }))).toBeNull();
  });

  it('names the specific preparation issue for the status chip, in checklist order', () => {
    // vaccination outstanding + tappable, admission outstanding + not tappable.
    expect(outstandingIssueLabel(checklist())).toBe('Incomplete vaccination');
    expect(
      outstandingIssueLabel(checklist({ agreement: { status: 'outstanding', tappable: true } })),
    ).toBe('Agreement unsigned');
    expect(
      outstandingIssueLabel(checklist({ payment: { status: 'outstanding', tappable: true } })),
    ).toBe('Payment incomplete');
  });

  it('is null once every actionable item is done, even though admission stays outstanding', () => {
    // Admission alone (always outstanding, never tappable) must never block "All set".
    expect(
      outstandingIssueLabel(checklist({ vaccination: { status: 'done', tappable: false } })),
    ).toBeNull();
  });
});

describe('quick actions', () => {
  const labels = (state: Parameters<typeof quickActionsFor>[0]): string[] =>
    quickActionsFor(state).map((a) => a.label);

  it('matches the design table per state', () => {
    expect(labels('A')).toEqual(['Add your pet', 'Profile']);
    expect(labels('B1')).toEqual(['My stays', 'My pets', 'Leave feedback', 'Profile']);
    expect(labels('B2')).toEqual(['My stays', 'My pets', 'Leave feedback', 'Profile']);
    expect(labels('C1')).toEqual(['Prepare', 'My stays', 'Book a stay', 'Leave feedback']);
    expect(labels('C2')).toEqual(['Prepare', 'My stays', 'Book a stay', 'Leave feedback']);
  });

  it('never repeats a label within a state, and B does not repeat its hero', () => {
    (['A', 'B1', 'B2', 'C1', 'C2'] as const).forEach((state) => {
      expect(new Set(labels(state)).size).toBe(labels(state).length);
    });
    // B's hero is the booking call to action, so the grid leaves booking out.
    expect(labels('B1')).not.toContain('Book a stay');
    expect(labels('B2')).not.toContain('Book a stay');
  });

  it('pet actions open the pets tab, feedback opens the feedback page, Profile the profile', () => {
    const linkFor = (
      state: Parameters<typeof quickActionsFor>[0],
      label: string,
    ): string | undefined => quickActionsFor(state).find((action) => action.label === label)?.to;
    expect(linkFor('A', 'Add your pet')).toBe('/parent/profile?tab=pets');
    expect(linkFor('A', 'Profile')).toBe('/parent/profile');
    expect(linkFor('B1', 'Profile')).toBe('/parent/profile');
    expect(linkFor('B1', 'My pets')).toBe('/parent/profile?tab=pets');
    expect(linkFor('B2', 'My stays')).toBe('/parent/stays');
    expect(linkFor('B2', 'Leave feedback')).toBe('/parent/feedback');
    expect(linkFor('C1', 'Book a stay')).toBe('/parent/booking');
    expect(linkFor('C2', 'Leave feedback')).toBe('/parent/feedback');
  });

  it('points Prepare at the first outstanding checklist page', () => {
    expect(resolveQuickActions('C1', [stay()])[0]).toMatchObject({
      label: 'Prepare',
      to: '/parent/vaccination/bp-max',
    });
  });

  it('swaps Prepare for My pets once nothing is left to prepare, rather than repeat My stays', () => {
    const done = stay(checklist({ vaccination: { status: 'done', tappable: false } }));
    expect(resolveQuickActions('C1', [done]).map((action) => action.label)).toEqual([
      'My pets',
      'My stays',
      'Book a stay',
      'Leave feedback',
    ]);
    expect(resolveQuickActions('C1', [done])[0]?.to).toBe('/parent/profile?tab=pets');
  });

  it('Prepare is keyed to the hero booking only, not a later one', () => {
    const done = stay(checklist({ vaccination: { status: 'done', tappable: false } }));
    // The hero (first) has nothing outstanding, even though the next booking
    // does. Prepare should not jump ahead to it.
    expect(resolveQuickActions('C1', [done, stay()])[0]?.label).toBe('My pets');
    expect(resolveQuickActions('C1', [])[0]?.label).toBe('My pets');
  });

  it('while a stay is under way, leads with its updates and keeps booking and feedback', () => {
    const current = {
      bookingId: 'b-now',
      confirmationNumber: 'PB-NOWNOW',
      dropOffAt: new Date(2026, 8, 5).toISOString(),
      pickUpAt: new Date(2026, 8, 9).toISOString(),
      nights: 4,
      serviceType: 'Boarding',
      pets: [{ bookingPetId: 'bp-now', petId: '1', name: 'Max' }],
      daysUntilPickUp: 2,
    };
    expect(quickActionsDuringStay(current).map((action) => [action.label, action.to])).toEqual([
      ["Today's updates", '/parent/live-care/bp-now'],
      ['My stays', '/parent/stays'],
      ['Book a stay', '/parent/booking'],
      ['Leave feedback', '/parent/feedback'],
    ]);
    expect(resolveQuickActions('C1', [stay()], current)[0]?.label).toBe("Today's updates");
  });
});

describe('homepage words in Chinese', () => {
  it('joins pet names with the Chinese list mark and conjunctions', () => {
    expect(joinNames(['Max', 'Luna', 'Rex'], 'and', 'zh')).toBe('Max、Luna 和 Rex');
    expect(joinNames(['Max', 'Luna'], 'or', 'zh')).toBe('Max 或 Luna');
  });

  it('writes the greeting, the book hero and the counts in Chinese', () => {
    expect(greetingFor('B2', 'Phuong', [max, luna], false, 'zh')).toEqual({
      title: '欢迎回来，Phuong',
      subline: '准备好安排 Max 和 Luna 的下一次住宿了吗？',
    });
    expect(greetingFor('A', null, [], false, 'zh').title).toBe('欢迎');
    expect(bookHeroFor('B1', [max, luna], 'zh').body).toBe('为 Max 或 Luna 选好日期和服务。');
    expect(upcomingTitle(stay(), 'zh')).toBe('Max 的住宿快到了');
    expect(daysToGoLabel(0, 'zh')).toBe('今天');
    expect(daysToGoCompactLabel(16, 'zh')).toBe('16 天后');
    expect(pickUpLabel(1, 'zh')).toBe('明天离店');
  });

  it('names the breed, the species and the age in Chinese', () => {
    expect(petMeta(max, 'zh')).toBe('拉布拉多 · 4\u00a0岁');
    expect(petMeta(luna, 'zh')).toBe('猫咪 · 2\u00a0岁');
  });

  it('names the outstanding issue in Chinese', () => {
    expect(outstandingIssueLabel(checklist(), 'zh')).toBe('疫苗信息不全');
  });

  it('labels the quick actions in Chinese without changing where they lead', () => {
    expect(
      resolveQuickActions('C1', [stay()], null, 'zh').map((action) => [action.label, action.to]),
    ).toEqual([
      ['住前准备', '/parent/vaccination/bp-max'],
      ['我的住宿', '/parent/stays'],
      ['预订住宿', '/parent/booking'],
      ['留下反馈', '/parent/feedback'],
    ]);
  });
});

describe('home dates in Chinese', () => {
  it('writes a short stay range in Chinese', () => {
    const start = new Date(2026, 8, 12).toISOString();
    expect(formatCompactRange(start, new Date(2026, 8, 16).toISOString(), 'zh')).toBe(
      '9月12日至16日',
    );
    expect(formatCompactRange(start, new Date(2026, 9, 2).toISOString(), 'zh')).toBe(
      '9月12日至10月2日',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  selectInquiryCounts,
  selectInquiryList,
  type InquiryListSelectorOptions,
} from '../inquirySelectors';
import type { InquiryConversation } from '../../types/inquiry';
import { toInquiryCalendarDate } from '../../utils/inquiryTime';

function makeInquiry(overrides: Partial<InquiryConversation> = {}): InquiryConversation {
  return {
    uuid: 'inq-1',
    parentName: 'Sarah Nguyen',
    parentInitials: 'SN',
    petName: 'Bella',
    topic: "Bella's Care Updates",
    topicCategory: 'Feeding',
    startedAt: '2026-06-15T10:00:00.000Z',
    durationMinutes: 20,
    status: 'Active',
    supportStatus: 'AI Handling',
    supportRequestedAt: null,
    assignee: null,
    notes: '',
    aiSummary: 'Sarah asked about feeding.',
    aiDetectedTopic: 'Feeding',
    aiEscalationReason: null,
    aiRelevantInfo: 'Fed at noon.',
    messages: [],
    ...overrides,
  };
}

const BASE_OPTIONS: InquiryListSelectorOptions = {
  tab: 'Active',
  searchQuery: '',
  supportStatusFilter: 'All',
  dateFrom: '',
  dateTo: '',
  assigneeId: 'All',
  parentNameQuery: '',
  topicQuery: '',
  durationMin: null,
  durationMax: null,
  notesFilter: 'All',
  sort: { field: 'startedAt', direction: 'desc' },
};

describe('selectInquiryList - tab', () => {
  it('excludes Closed conversations from the Active tab and vice versa', () => {
    const active = makeInquiry({ uuid: 'a', status: 'Active' });
    const closed = makeInquiry({ uuid: 'c', status: 'Closed' });

    expect(selectInquiryList([active, closed], { ...BASE_OPTIONS, tab: 'Active' })).toEqual([
      active,
    ]);
    expect(selectInquiryList([active, closed], { ...BASE_OPTIONS, tab: 'Closed' })).toEqual([
      closed,
    ]);
  });
});

describe('selectInquiryList - searchQuery', () => {
  it('matches across parent name, pet name, topic, and AI summary', () => {
    const byParent = makeInquiry({ uuid: 'p', parentName: 'Zoe Unique' });
    const byPet = makeInquiry({ uuid: 'pet', petName: 'UniquePet' });
    const byTopic = makeInquiry({ uuid: 't', topic: 'UniqueTopic' });
    const bySummary = makeInquiry({ uuid: 's', aiSummary: 'contains uniqueword here' });
    const noMatch = makeInquiry({ uuid: 'n' });

    const all = [byParent, byPet, byTopic, bySummary, noMatch];
    expect(selectInquiryList(all, { ...BASE_OPTIONS, searchQuery: 'Zoe Unique' })).toEqual([
      byParent,
    ]);
    expect(selectInquiryList(all, { ...BASE_OPTIONS, searchQuery: 'uniquepet' })).toEqual([byPet]);
    expect(selectInquiryList(all, { ...BASE_OPTIONS, searchQuery: 'uniquetopic' })).toEqual([
      byTopic,
    ]);
    expect(selectInquiryList(all, { ...BASE_OPTIONS, searchQuery: 'uniqueword' })).toEqual([
      bySummary,
    ]);
  });

  it('matches everything when the query is empty', () => {
    const inquiries = [makeInquiry({ uuid: 'a' }), makeInquiry({ uuid: 'b' })];
    expect(selectInquiryList(inquiries, BASE_OPTIONS)).toHaveLength(2);
  });
});

describe('selectInquiryList - parentNameQuery isolation', () => {
  it('matches only against parentName, not topic or pet name', () => {
    const target = makeInquiry({ uuid: 'target', parentName: 'Distinctive Parent' });
    const decoy = makeInquiry({ uuid: 'decoy', topic: 'Distinctive Parent' });

    const result = selectInquiryList([target, decoy], {
      ...BASE_OPTIONS,
      parentNameQuery: 'Distinctive',
    });

    expect(result).toEqual([target]);
  });
});

describe('selectInquiryList - topicQuery isolation', () => {
  it('matches only against topic, not parentName', () => {
    const target = makeInquiry({ uuid: 'target', topic: 'Distinctive Topic' });
    const decoy = makeInquiry({ uuid: 'decoy', parentName: 'Distinctive Topic' });

    const result = selectInquiryList([target, decoy], {
      ...BASE_OPTIONS,
      topicQuery: 'Distinctive',
    });

    expect(result).toEqual([target]);
  });
});

describe('selectInquiryList - supportStatusFilter', () => {
  it('"All" passes everything; a specific status excludes non-matching rows', () => {
    const handling = makeInquiry({ uuid: 'h', supportStatus: 'Support Handling' });
    const aiOnly = makeInquiry({ uuid: 'ai', supportStatus: 'AI Handling' });

    expect(selectInquiryList([handling, aiOnly], BASE_OPTIONS)).toHaveLength(2);
    expect(
      selectInquiryList([handling, aiOnly], {
        ...BASE_OPTIONS,
        supportStatusFilter: 'Support Handling',
      }),
    ).toEqual([handling]);
  });
});

describe('selectInquiryList - assigneeId', () => {
  const unassigned = makeInquiry({ uuid: 'u', assignee: null });
  const assignedToA = makeInquiry({ uuid: 'a', assignee: { id: 'staff-a', name: 'A' } });
  const assignedToB = makeInquiry({ uuid: 'b', assignee: { id: 'staff-b', name: 'B' } });
  const all = [unassigned, assignedToA, assignedToB];

  it('"All" passes everything', () => {
    expect(selectInquiryList(all, BASE_OPTIONS)).toHaveLength(3);
  });

  it('"Unassigned" matches only assignee === null', () => {
    expect(selectInquiryList(all, { ...BASE_OPTIONS, assigneeId: 'Unassigned' })).toEqual([
      unassigned,
    ]);
  });

  it('a specific id matches only that assignee', () => {
    expect(selectInquiryList(all, { ...BASE_OPTIONS, assigneeId: 'staff-a' })).toEqual([
      assignedToA,
    ]);
  });
});

describe('selectInquiryList - date range boundaries', () => {
  const onLowerBound = makeInquiry({ uuid: 'low', startedAt: '2026-06-10T23:00:00.000Z' });
  const middle = makeInquiry({ uuid: 'mid', startedAt: '2026-06-15T10:00:00.000Z' });
  const onUpperBound = makeInquiry({ uuid: 'high', startedAt: '2026-06-20T01:00:00.000Z' });
  const outside = makeInquiry({ uuid: 'out', startedAt: '2026-07-01T10:00:00.000Z' });

  it('is inclusive on both bounds', () => {
    // Use each conversation's own local calendar date as the from/to bound so this test is
    // not sensitive to the runner's timezone.
    const dateFrom = toInquiryCalendarDate(onLowerBound.startedAt);
    const dateTo = toInquiryCalendarDate(onUpperBound.startedAt);

    const result = selectInquiryList([onLowerBound, middle, onUpperBound, outside], {
      ...BASE_OPTIONS,
      dateFrom,
      dateTo,
    });

    expect(result.map((inquiry) => inquiry.uuid).sort()).toEqual(['high', 'low', 'mid'].sort());
    expect(result.some((inquiry) => inquiry.uuid === 'out')).toBe(false);
  });

  it('treats an empty dateFrom/dateTo as unbounded on that side', () => {
    const dateTo = toInquiryCalendarDate(middle.startedAt);

    const result = selectInquiryList([onLowerBound, middle, outside], {
      ...BASE_OPTIONS,
      dateFrom: '',
      dateTo,
    });

    expect(result.map((inquiry) => inquiry.uuid).sort()).toEqual(['low', 'mid'].sort());
  });
});

describe('selectInquiryList - duration bounds', () => {
  const short = makeInquiry({ uuid: 's', durationMinutes: 5 });
  const exact = makeInquiry({ uuid: 'e', durationMinutes: 10 });
  const long = makeInquiry({ uuid: 'l', durationMinutes: 30 });

  it('is inclusive on both bounds', () => {
    const result = selectInquiryList([short, exact, long], {
      ...BASE_OPTIONS,
      durationMin: 10,
      durationMax: 10,
    });
    expect(result).toEqual([exact]);
  });

  it('null on either bound means unbounded on that side', () => {
    const result = selectInquiryList([short, exact, long], {
      ...BASE_OPTIONS,
      durationMin: 10,
      durationMax: null,
    });
    expect(result.map((inquiry) => inquiry.uuid).sort()).toEqual(['e', 'l']);
  });
});

describe('selectInquiryList - notesFilter', () => {
  const withNotes = makeInquiry({ uuid: 'w', notes: 'Some note' });
  const noNotes = makeInquiry({ uuid: 'n', notes: '' });
  const whitespaceOnly = makeInquiry({ uuid: 'ws', notes: '   ' });

  it('"With notes" requires a non-whitespace notes string', () => {
    const result = selectInquiryList([withNotes, noNotes, whitespaceOnly], {
      ...BASE_OPTIONS,
      notesFilter: 'With notes',
    });
    expect(result).toEqual([withNotes]);
  });

  it('"No notes" requires an empty/whitespace-only notes string', () => {
    const result = selectInquiryList([withNotes, noNotes, whitespaceOnly], {
      ...BASE_OPTIONS,
      notesFilter: 'No notes',
    });
    expect(result.map((inquiry) => inquiry.uuid).sort()).toEqual(['n', 'ws']);
  });

  it('"All" passes everything', () => {
    expect(
      selectInquiryList([withNotes, noNotes, whitespaceOnly], {
        ...BASE_OPTIONS,
        notesFilter: 'All',
      }),
    ).toHaveLength(3);
  });
});

describe('selectInquiryList - combined filters (AND logic)', () => {
  it('excludes a row that fails any single filter even if it matches all others', () => {
    const matchesEverythingExceptStatus = makeInquiry({
      uuid: 'x',
      parentName: 'Combo Parent',
      supportStatus: 'Support Handling',
    });
    const matchesAll = makeInquiry({
      uuid: 'y',
      parentName: 'Combo Parent',
      supportStatus: 'AI Handling',
    });

    const result = selectInquiryList([matchesEverythingExceptStatus, matchesAll], {
      ...BASE_OPTIONS,
      parentNameQuery: 'Combo',
      supportStatusFilter: 'AI Handling',
    });

    expect(result).toEqual([matchesAll]);
  });
});

describe('selectInquiryList - sort', () => {
  const earliest = makeInquiry({
    uuid: 'e',
    startedAt: '2026-06-01T00:00:00.000Z',
    durationMinutes: 30,
  });
  const middle = makeInquiry({
    uuid: 'm',
    startedAt: '2026-06-10T00:00:00.000Z',
    durationMinutes: 10,
  });
  const latest = makeInquiry({
    uuid: 'l',
    startedAt: '2026-06-20T00:00:00.000Z',
    durationMinutes: 20,
  });
  const all = [middle, latest, earliest];

  it('sorts by startedAt desc (newest first) by default', () => {
    const result = selectInquiryList(all, {
      ...BASE_OPTIONS,
      sort: { field: 'startedAt', direction: 'desc' },
    });
    expect(result.map((inquiry) => inquiry.uuid)).toEqual(['l', 'm', 'e']);
  });

  it('reverses with startedAt asc', () => {
    const result = selectInquiryList(all, {
      ...BASE_OPTIONS,
      sort: { field: 'startedAt', direction: 'asc' },
    });
    expect(result.map((inquiry) => inquiry.uuid)).toEqual(['e', 'm', 'l']);
  });

  it('sorts by durationMinutes independent of startedAt', () => {
    const asc = selectInquiryList(all, {
      ...BASE_OPTIONS,
      sort: { field: 'durationMinutes', direction: 'asc' },
    });
    expect(asc.map((inquiry) => inquiry.uuid)).toEqual(['m', 'l', 'e']);

    const desc = selectInquiryList(all, {
      ...BASE_OPTIONS,
      sort: { field: 'durationMinutes', direction: 'desc' },
    });
    expect(desc.map((inquiry) => inquiry.uuid)).toEqual(['e', 'l', 'm']);
  });
});

describe('selectInquiryCounts', () => {
  it('counts Active and Closed independently of any list filters', () => {
    const inquiries = [
      makeInquiry({ uuid: 'a1', status: 'Active' }),
      makeInquiry({ uuid: 'a2', status: 'Active' }),
      makeInquiry({ uuid: 'c1', status: 'Closed' }),
    ];
    expect(selectInquiryCounts(inquiries)).toEqual({ active: 2, closed: 1 });
  });
});

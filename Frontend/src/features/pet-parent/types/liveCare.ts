import type { CSSProperties } from 'react';

/** The staff task's state as a parent reads it; overdue is for staff only, so it stays upcoming. */
export type Status = 'completed' | 'in_progress' | 'upcoming';
export type Category = 'potty' | 'meal' | 'solo' | 'play' | 'other';

export interface CareEntry {
  id: string;
  /** "9:00 AM", or null while the task has no time yet (staff see "Time not set"). */
  time: string | null;
  title: string;
  category: Category;
  icon: string;
  status: Status;
  detail?: string;
  /** `detail` machine-translated into Chinese; sent only when Chinese was asked for. */
  detailInChinese?: string;
  mood?: string;
  photoCount?: number;
  /** Actual photo URLs for this entry. A card is only clickable when this is
   * a non-empty array. `photoCount` alone (with no URLs) just renders the
   * "N photos" tag without making the card interactive. */
  photos?: string[];
}

export interface StatTile {
  label: string;
  value: string;
}

/** GET /api/petparent/live-care[/:bookingPetId] response shape. */
export interface LiveCareData {
  bookingPetId: string;
  petId: string;
  petName: string;
  petPhotoUrl?: string;
  /** The staff member rostered onto the pet, or null when nobody is yet. */
  sitterName: string | null;
  /** That staff member's facility; null with no carer or no facility on file. */
  location: string | null;
  dropOffDate: string;
  pickUpDate: string;
  /** Every day of the stay, 'YYYY-MM-DD', drop-off through pick-up inclusive. */
  availableDates: string[];
  selectedDate: string;
  entries: CareEntry[];
  stats: StatTile[];
}

/**
 * What happened to one dose, read from its care task. Only 'given' means staff ticked it. 'due' is
 * not yet given and inside its hour; 'overdue' is past its hour with no record, and staff have been
 * alerted; 'not_given' is staff's own record that it was not given; 'not_recorded' has no record.
 */
export type DoseStatus = 'due' | 'overdue' | 'given' | 'not_given' | 'not_recorded';

export interface DoseRecord {
  id: string;
  medicationId: string;
  medicineName: string;
  dose: number;
  unit: string;
  /** The time-of-day word or exact "HH:mm" the dose is scheduled for. */
  slot: string;
  /** ISO instant the dose is due. */
  dueAt: string;
  status: DoseStatus;
  /** ISO instant staff ticked it, when given. */
  givenAt: string | null;
  /** The staff member's display name, when the task names one. */
  givenBy: string | null;
  /** Why it was not given, when staff recorded that. */
  reason: string | null;
}

export interface RecordMedicine {
  id: string;
  name: string;
  dose: number;
  unit: string;
  schedule: string[];
}

/** GET /api/petparent/stays/:bookingPetId/medication-record?date= response shape. */
export interface MedicationRecordDay {
  bookingPetId: string;
  /** YYYY-MM-DD in New Zealand. */
  date: string;
  /** The medicines on the pet's profile that this stay gives. */
  medicines: RecordMedicine[];
  doses: DoseRecord[];
}

/**
 * 'daily' is the update sent at the parent's chosen hour (5 pm unless they changed it) on each day
 * of the stay; 'stay_report' is sent on pick-up day; 'arrival' is the short "settled in" note sent
 * on the drop-off day, with the first photo when there is one.
 */
export type SummaryKind = 'daily' | 'stay_report' | 'arrival';

/**
 * One update a stay sent its parent, written by the server from the day's records.
 * GET /api/petparent/stays/:bookingPetId/summaries answers `{ summaries: StaySummary[] }`.
 */
/** A short video when staff attached one that day, else the newest photo. */
export interface SummaryMedia {
  kind: 'photo' | 'video';
  /** A URL the browser can load (the api client adds the API base). */
  url: string;
}

export interface StaySummary {
  id: string;
  bookingPetId: string;
  /** The Auckland day the update is about, 'YYYY-MM-DD'. */
  date: string;
  kind: SummaryKind;
  /** The language `body` was written in: the parent's chosen one at the time it was sent. */
  locale: 'en' | 'zh';
  /** Plain sentences in `locale`, shown as delivered. */
  body: string;
  /** The day's curated photo or short video as a URL the browser can load, or null when none.
   * Kept for older readers; `media` says which of the two it is. */
  photoPath: string | null;
  /** The update's photo or short video, or null when the day had none. */
  media: SummaryMedia | null;
  facts: Record<string, unknown>;
  /** ISO instant the update was written. */
  generatedAt: string;
}

export interface RingStyle extends CSSProperties {
  '--pct'?: number;
}

/** One flattened photo, tagged with which entry it came from (for alt text
 * and captions in the all-day carousel). */
export interface DayPhoto {
  src: string;
  alt: string;
  entryTitle: string;
  entryTime: string;
}

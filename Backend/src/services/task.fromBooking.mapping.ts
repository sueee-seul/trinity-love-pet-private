import type { Priority } from '../modules/tasks/task.types.js';

// ---------------------------------------------------------------------------
// Booking -> task generation (mapping)
//
// Implements the "Task Connection in Pet profile" table: turn one booking pet's
// services and intake questionnaire into pending pet-task specs. Service
// matching is done on both `category` and `name` (case-insensitive substring)
// so it survives either service seed.
//
// Tasks priced "per day" (feeding, medication administration, extra playtime,
// outdoor walk) are generated once for each night of the stay; "per stay"
// services (grooming) are generated once regardless of length.
// ---------------------------------------------------------------------------

export type BookingServiceRef = {
  name: string | null;
  category: string | null;
  price_unit: string | null;
};

export type BookingTaskInputRow = {
  pet_id: string;
  // Date only ('YYYY-MM-DD', Pacific/Auckland): the day the stay starts.
  drop_off_date: string | null;
  // Date only ('YYYY-MM-DD', Pacific/Auckland): the day the stay ends.
  pick_up_date: string | null;
  feeding_routine: string | null;
  medication_instructions: string | null;
  services: BookingServiceRef[];
};

export type GeneratedTaskSpec = {
  petId: string;
  title: string;
  scheduledAt: string | null;
  description: string | null;
  issue: string | null;
  priority: Priority;
};

const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// The time of day (Pacific/Auckland) each generated task starts at, so staff and the pet parent
// see a real time from the start. Two meals 11 hours apart follow vet guidance (two meals 8 to 12
// hours apart, breakfast 6 to 8 AM, dinner 5 to 7 PM), at its late end because the facility's day
// runs late. Medication follows breakfast so it goes down with food, and every time is at least
// 30 minutes from the next, the gap one staff member needs between two tasks. Grooming has no
// time: the manager fits it to the groomer's day.
const TASK_CLOCK = {
  morningMeal: '08:00',
  medication: '08:30',
  outdoorWalk: '10:30',
  extraPlaytime: '16:00',
  eveningMeal: '19:00',
} as const;

const MEAL_CLOCK = { morning: TASK_CLOCK.morningMeal, evening: TASK_CLOCK.eveningMeal } as const;

// Number of nights the stay covers, minimum 1 - mirrors nightsBetween in
// services/petparent.booking.ts, reimplemented here since that helper is
// module-private and this is a different domain (tasks, not pricing).
const nightsBetween = (dropOffDate: string | null, pickUpDate: string | null): number => {
  if (!dropOffDate || !pickUpDate) return 1;
  const start = new Date(`${dropOffDate}T00:00:00Z`).getTime();
  const end = new Date(`${pickUpDate}T00:00:00Z`).getTime();
  return Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 1);
};

export const buildTaskSpecs = (row: BookingTaskInputRow): GeneratedTaskSpec[] => {
  const specs: GeneratedTaskSpec[] = [];
  // Date only: the day the stay starts.
  const dropOffDate = trimToNull(row.drop_off_date);
  const pickUpDate = trimToNull(row.pick_up_date);
  const nights = nightsBetween(dropOffDate, pickUpDate);
  const services = Array.isArray(row.services) ? row.services : [];

  const serviceText = (service: BookingServiceRef): string =>
    `${service.name ?? ''} ${service.category ?? ''}`.toLowerCase();
  // First service whose name or category contains any of the keywords.
  const matchService = (keywords: string[]): BookingServiceRef | null =>
    services.find((service) => keywords.some((kw) => serviceText(service).includes(kw))) ?? null;

  // "per stay" services run once regardless of stay length; everyting else
  //(including a matched service with no price_unit on record) repeats daily.
  const repeatForService = (service: BookingServiceRef | null): number =>
    service?.price_unit === 'per stay' ? 1 : nights;

  // scheduled_at holds Auckland wall-clock time in the UTC slot, so the clock is written as UTC.
  // With no clock the task keeps the date-only placeholder (midnight, "time not set").
  const scheduledAtForDay = (day: number, clock?: string): string | null => {
    if (!dropOffDate) return null;
    const date = addDays(dropOffDate, day);
    return clock ? `${date}T${clock}:00Z` : date;
  };

  const base = { petId: row.pet_id };

  // Feeding: every boarded pet is fed morning and evening (the common default),
  // so always two tasks. "House food" is the default when no Food service is
  // Food service is picked ("defaults to our house food if left unselected");
  // its name, if any, goes in the description. The feeding-routine answer
  // goes into the Issue column. A third feeding is added only when the owner
  const feedingRoutine = trimToNull(row.feeding_routine);
  const baseFoodService =
    services.find((service) => /food|meal|feed|diet/.test(serviceText(service))) ?? null;
  const foodLabel = trimToNull(baseFoodService?.name ?? null) ?? 'House food (default)';
  for (let day = 0; day < nights; day++) {
    for (const slot of ['morning', 'evening'] as const) {
      specs.push({
        ...base,
        scheduledAt: scheduledAtForDay(day, MEAL_CLOCK[slot]),
        title: `Feeding (${slot})`,
        description: foodLabel,
        issue: feedingRoutine,
        priority: 'mid',
      });
    }
  }

  // Grooming session -> Grooming Task. Scheduled the day before checkout so
  // the pet goes home freshly groomed.
  const groomingService = matchService(['groom']);
  if (groomingService) {
    specs.push({
      ...base,
      scheduledAt: scheduledAtForDay(nights - 1),
      title: 'Grooming',
      description: null,
      issue: null,
      priority: 'mid',
    });
  }

  // Extra playtime -> Extra Playtime Task
  const playtimeService = matchService(['playtime']);
  if (playtimeService) {
    for (let day = 0; day < repeatForService(playtimeService); day++) {
      specs.push({
        ...base,
        scheduledAt: scheduledAtForDay(day, TASK_CLOCK.extraPlaytime),
        title: 'Extra Playtime',
        description: null,
        issue: null,
        priority: 'mid',
      });
    }
  }

  // Medication administration -> Medication Administration Task, with the
  // instructions (OQ) added into the Issue column. Repeats daily whenever
  // medication is involved, matched service or not, because medication is assumed to
  // be an everyday need for the length of the stay.
  const medicationService = matchService(['medication']);
  const medicationInstructions = trimToNull(row.medication_instructions);
  if (medicationService || medicationInstructions) {
    for (let day = 0; day < repeatForService(medicationService); day++) {
      specs.push({
        ...base,
        scheduledAt: scheduledAtForDay(day, TASK_CLOCK.medication),
        title: 'Medication Administration',
        description: null,
        issue: medicationInstructions,
        priority: 'high',
      });
    }
  }

  // Outdoor Walk -> Outdoor Walk Task, once per day of the stay.
  const outdoorWalkService = matchService(['outdoor']);
  if (outdoorWalkService) {
    for (let day = 0; day < repeatForService(outdoorWalkService); day++) {
      specs.push({
        ...base,
        scheduledAt: scheduledAtForDay(day, TASK_CLOCK.outdoorWalk),
        title: 'Outdoor Walk',
        description: null,
        issue: null,
        priority: 'mid',
      });
    }
  }

  return specs;
};

import { todayInNewZealand } from './format';

/** The New Zealand calendar date of an instant the server sent, e.g. a review deadline. */
export const newZealandDateOf = (isoTimestamp: string): string =>
  todayInNewZealand(new Date(isoTimestamp));

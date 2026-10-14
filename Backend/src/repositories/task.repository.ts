// Barrel: the task repository split by concern (no logic changed, queries moved
// verbatim). Import from here as before (`import * as repository from
// '.../task.repository.js'`); the parts live in:
//   task.read.repository.ts:       taskSelect, ranges, list / find queries
//   task.mutation.repository.ts:   insert / update / complete / delete
//   task.assignment.repository.ts: available assignments, stay-window check
//   task.scheduling.repository.ts: shift / double-booking conflict checks
//   task.photo.repository.ts:      media_logs (task completion photos)
//   task.fromBooking.repository.ts: booking reads + generated-task insert
export * from './task.read.repository.js';
export * from './task.mutation.repository.js';
export * from './task.assignment.repository.js';
export * from './task.scheduling.repository.js';
export * from './task.photo.repository.js';
export * from './task.fromBooking.repository.js';

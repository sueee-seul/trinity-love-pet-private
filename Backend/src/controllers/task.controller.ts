// Barrel: the task controller split by concern. `task.routes.ts` imports the
// handlers from here as before; the parts live in:
//   task.read.controller.ts:       list / get endpoints
//   task.write.controller.ts:      create / update / complete / delete
//   task.staff.controller.ts:      task-staff and free-staff lookups
//   task.photo.controller.ts:      task completion photo upload / serve / delete
//   task.fromBooking.controller.ts: booking -> pet-task generation
// (shared request helpers live in task.controller.helpers.ts)
export * from './task.read.controller.js';
export * from './task.write.controller.js';
export * from './task.staff.controller.js';
export * from './task.photo.controller.js';
export * from './task.fromBooking.controller.js';

// Barrel: the task service split by concern. Import from here as before
// (`import * as service from '.../task.service.js'`); the parts live in:
//   task.service.base.ts:       types, TaskServiceError, read passthroughs
//   task.scheduling.service.ts: shift / double-booking / stay-window guards
//   task.service.core.ts:       create / update / complete / delete
//   task.photo.service.ts:      task completion photos
//   task.fromBooking.*.ts:      booking -> pet-task generation
export * from './task.service.base.js';
export * from './task.scheduling.service.js';
export * from './task.service.core.js';
export * from './task.photo.service.js';
export * from './task.fromBooking.mapping.js';
export * from './task.fromBooking.service.js';

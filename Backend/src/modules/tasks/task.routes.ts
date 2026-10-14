import { Router } from 'express';
import {
  requireEmployee,
  requireManager,
  requireAuth,
} from '../../common/middlewares/auth.middleware.js';
import { taskMediaUpload } from '../../common/middlewares/task-media-upload.middleware.js';
import {
  getTaskAssignments,
  getPetTasks,
  getStaffTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  getTaskTemplates,
  getTaskStaff,
  getFreeStaff,
  uploadTaskPhoto,
  getTaskPhoto,
  deleteTaskPhoto,
  createTasksFromBooking,
} from '../../controllers/task.controller.js';

export const taskRouter = Router();
taskRouter.get('/tasks/:taskId/photos/:storedName', requireAuth, getTaskPhoto);
taskRouter.use(requireEmployee);
taskRouter.get('/pets/:petId/task-assignments', getTaskAssignments);
taskRouter.get('/pets/:petId/tasks', getPetTasks);
taskRouter.get('/staff/:staffId/tasks', getStaffTasks);
taskRouter.get('/tasks/:taskId', getTask);
taskRouter.post('/pets/:petId/tasks', requireManager, createTask);
// Fan a booking's services + intake answers out into pending pet tasks
// ("Task Connection in Pet profile"). Safe to call again: duplicates are skipped.
taskRouter.post('/tasks/from-booking/:bookingId', requireManager, createTasksFromBooking);
taskRouter.patch('/tasks/:taskId', updateTask);

// Manager-only alias of the same handler, used by the Pet Profile Task
// Timeline (staff assign / exact time), which is a manager action. Staff's
// own "My Tasks" edits keep using the plain /tasks/:taskId route above.
taskRouter.patch('/pets/:petId/tasks/:taskId', requireManager, updateTask);
taskRouter.patch('/tasks/:taskId/complete', completeTask);
taskRouter.delete('/tasks/:taskId', requireManager, deleteTask);
// Photos and short videos share one list. The middleware caps one request at the per-task count;
// the service checks the count against what the task already holds.
taskRouter.post('/tasks/:taskId/photos', taskMediaUpload, uploadTaskPhoto);
taskRouter.delete('/tasks/:taskId/photos/:storedName', deleteTaskPhoto);
taskRouter.get('/task-templates', getTaskTemplates);
taskRouter.get('/task-staff', getTaskStaff);
taskRouter.get('/free-staff', getFreeStaff);

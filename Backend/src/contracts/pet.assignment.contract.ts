import { z } from 'zod';

export interface PetAssignment {
  uuid: string;
  petUuid: string;
  petName: string;
  employeeUuid: string;
  employeeName: string;
  assignmentDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
}

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (![year, month, day].every((part) => Number.isInteger(part))) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const isoDateSchema = z.string().refine(isValidIsoDate, 'Assignment date must be YYYY-MM-DD');
const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Shift time must be HH:mm')
  .nullable();

export const petIdSchema = z.string().uuid('Pet ID must be a valid UUID');
export const assignmentIdSchema = z.string().uuid('Assignment ID must be a valid UUID');

export const createPetAssignmentSchema = z
  .object({
    employeeUuid: z.string().uuid('Employee UUID must be a valid UUID'),
    assignmentDate: isoDateSchema,
    shiftStart: timeSchema,
    shiftEnd: timeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hasStart = value.shiftStart !== null;
    const hasEnd = value.shiftEnd !== null;
    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shiftStart'],
        message: 'Shift start and shift end must both be null or both be present',
      });
      return;
    }

    if (
      value.shiftStart !== null &&
      value.shiftEnd !== null &&
      value.shiftStart >= value.shiftEnd
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shiftEnd'],
        message: 'Shift start must be earlier than shift end',
      });
    }
  });

export type CreatePetAssignmentInput = z.infer<typeof createPetAssignmentSchema>;

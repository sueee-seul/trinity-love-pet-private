import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import petRoutes from '../routes/pet.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';

const { managerUser } = vi.hoisted(() => ({
  managerUser: {
    id: '00000000-0000-4000-8000-000000000201',
    email: 'manager@example.test',
    name: 'Manager One',
    is_employee: true,
    is_pet_owner: false,
    employee_role: 'manager' as const,
    isUsingTemporaryPassword: false,
  },
}));

// These routes are staff-only now. The session cookie itself is
// `auth.middleware.test.ts`'s subject; here the caller is always signed in, so
// these tests keep checking what they were written to check.
vi.mock('../common/middlewares/auth.middleware.js', () => {
  const signedIn = (req: Request, _res: Response, next: NextFunction): void => {
    req.user = managerUser;
    next();
  };
  return { requireEmployee: signedIn, requireManager: signedIn };
});

vi.mock('../repositories/pet.repository.js', () => ({
  listPetRecords: vi.fn(),
  getPetRecordById: vi.fn(),
  updatePetRecord: vi.fn(),
  listPetMedications: vi.fn(),
}));

import {
  listPetRecords,
  getPetRecordById,
  updatePetRecord,
  listPetMedications,
  type PetRecord,
} from '../repositories/pet.repository.js';

const app = express();
app.use(express.json());
app.use('/api/admin/pets', petRoutes);
app.use(errorHandler);

const FAR_PAST = new Date('2000-01-01T00:00:00Z');
const FAR_FUTURE = new Date('2099-01-01T00:00:00Z');
const approvedStay = (dropOffTime: Date, pickUpTime: Date): PetRecord['stay'] => ({
  reviewStatus: 'approved',
  checkInOutcome: null,
  dropOffTime,
  pickUpTime,
});

const PET_FIXTURES: PetRecord[] = [
  {
    id: 'p1',
    name: 'Sherlock',
    stay: approvedStay(FAR_FUTURE, new Date('2099-01-05T00:00:00Z')),
    checkInDate: '15/08/2026',
    checkOutDate: '20/08/2026',
    type: 'Dog',
    age: 4,
    gender: 'Male',
    ownerName: 'Jennifer Andrews',
    breed: null,
    weight: null,
    microchipNumber: null,
    healthNotes: null,
    behaviourNotes: null,
  },
  {
    id: 'p2',
    name: 'Arctic Dog',
    stay: approvedStay(FAR_PAST, FAR_FUTURE),
    checkInDate: '10/08/2026',
    checkOutDate: '12/08/2026',
    type: 'Dog',
    age: 3,
    gender: 'Male',
    ownerName: 'Jason Lo',
    breed: null,
    weight: null,
    microchipNumber: null,
    healthNotes: null,
    behaviourNotes: null,
  },
  {
    id: 'p3',
    name: 'Cavoodle Pup',
    stay: approvedStay(FAR_PAST, new Date('2000-01-05T00:00:00Z')),
    checkInDate: '05/08/2026',
    checkOutDate: null,
    type: 'Dog',
    age: 1,
    gender: 'Female',
    ownerName: 'Hannah MAC',
    breed: null,
    weight: null,
    microchipNumber: null,
    healthNotes: null,
    behaviourNotes: null,
  },
  {
    id: 'p4',
    name: 'Whiskers',
    stay: null,
    checkInDate: '28/07/2026',
    checkOutDate: '02/08/2026',
    type: 'Cat',
    age: 2,
    gender: 'Female',
    ownerName: 'Scott Patterson',
    breed: null,
    weight: null,
    microchipNumber: null,
    healthNotes: null,
    behaviourNotes: null,
  },
];

let records: PetRecord[];

beforeEach(() => {
  records = PET_FIXTURES.map((pet) => ({ ...pet }));

  vi.mocked(listPetRecords).mockReset();
  vi.mocked(listPetRecords).mockImplementation(async () => records.map((pet) => ({ ...pet })));

  vi.mocked(getPetRecordById).mockReset();
  vi.mocked(getPetRecordById).mockImplementation(async (id) => {
    const record = records.find((pet) => pet.id === id);
    return record ? { ...record } : null;
  });

  vi.mocked(updatePetRecord).mockReset();
  vi.mocked(updatePetRecord).mockImplementation(async (id, input) => {
    const record = records.find((pet) => pet.id === id);
    if (!record) {
      return false;
    }
    Object.assign(record, input);
    return true;
  });

  vi.mocked(listPetMedications).mockReset();
  vi.mocked(listPetMedications).mockImplementation(async () => []);
});

describe('Pet APIs', () => {
  describe('GET /api/admin/pets', () => {
    it('should return all pets', async () => {
      const res = await request(app).get('/api/admin/pets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(PET_FIXTURES.length);
    });

    it('should include the profile contract without assignment-owned fields', async () => {
      const res = await request(app).get('/api/admin/pets');

      expect(res.status).toBe(200);
      expect(
        res.body.every(
          (pet: {
            id: string;
            name: string;
            type: string;
            age: number;
            gender: string;
            ownerName: string;
            checkInDate: string;
            checkOutDate: string | null;
          }) =>
            typeof pet.id === 'string' &&
            typeof pet.name === 'string' &&
            ['Dog', 'Cat', 'Other'].includes(pet.type) &&
            typeof pet.age === 'number' &&
            ['Male', 'Female'].includes(pet.gender) &&
            typeof pet.ownerName === 'string' &&
            typeof pet.checkInDate === 'string' &&
            (pet.checkOutDate === null || typeof pet.checkOutDate === 'string'),
        ),
      ).toBe(true);
      expect(res.body.every((pet: Record<string, unknown>) => !('assigneeId' in pet))).toBe(true);
    });

    it('names each pet by its current or next stay, with the status its owner reads', async () => {
      const res = await request(app).get('/api/admin/pets');

      const statusOf = (name: string): string | undefined =>
        res.body.find((pet: { name: string; status: string }) => pet.name === name)?.status;
      expect(statusOf('Sherlock')).toBe('approved');
      expect(statusOf('Arctic Dog')).toBe('staying_now');
      expect(statusOf('Cavoodle Pup')).toBe('stay_ended');
      expect(statusOf('Whiskers')).toBe('no_stay');
      expect(res.body.every((pet: Record<string, unknown>) => !('stay' in pet))).toBe(true);
    });

    it('should include at least one pet with a null checkout date', async () => {
      const res = await request(app).get('/api/admin/pets');

      expect(
        res.body.some((pet: { checkOutDate: string | null }) => pet.checkOutDate === null),
      ).toBe(true);
    });
  });

  describe('GET /api/admin/pets/:id', () => {
    it('should return the matching pet', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app).get(`/api/admin/pets/${firstPet.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(firstPet.id);
      expect(res.body.name).toBe(firstPet.name);
    });

    it('should return 404 for a non-existent pet', async () => {
      const res = await request(app).get('/api/admin/pets/no-such-pet');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/admin/pets/:id', () => {
    it('should update only the profile fields', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app).patch(`/api/admin/pets/${firstPet.id}`).send({
        type: 'Cat',
        gender: 'Female',
        age: 7,
        ownerName: 'Updated Owner',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: firstPet.id,
        name: firstPet.name,
        checkInDate: firstPet.checkInDate,
        checkOutDate: firstPet.checkOutDate,
        type: 'Cat',
        gender: 'Female',
        age: 7,
        ownerName: 'Updated Owner',
      });
      expect(res.body).not.toHaveProperty('assigneeId');
    });

    it('should reject the obsolete assigneeId field without mutating the pet', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }
      const originalOwnerName = firstPet.ownerName;

      const res = await request(app).patch(`/api/admin/pets/${firstPet.id}`).send({
        type: 'Dog',
        gender: 'Male',
        age: 3,
        ownerName: 'Someone',
        assigneeId: '00000000-0000-4000-8000-000000000202',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(records[0]?.ownerName).toBe(originalOwnerName);
      expect(updatePetRecord).not.toHaveBeenCalled();
    });

    it('should return 404 for a non-existent pet', async () => {
      const res = await request(app)
        .patch('/api/admin/pets/no-such-pet')
        .send({ type: 'Dog', gender: 'Male', age: 3, ownerName: 'Someone' });
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject an invalid type', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app)
        .patch(`/api/admin/pets/${firstPet.id}`)
        .send({ type: 'Fish', gender: 'Male', age: 3, ownerName: 'Someone' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should reject a non-positive age', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app)
        .patch(`/api/admin/pets/${firstPet.id}`)
        .send({ type: 'Dog', gender: 'Male', age: 0, ownerName: 'Someone' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('refuses a status in a profile update: the stay decides it', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app)
        .patch(`/api/admin/pets/${firstPet.id}`)
        .send({ status: 'checked out', type: 'Dog', gender: 'Male', age: 3, ownerName: 'Someone' });

      expect(res.status).toBe(400);
      expect(updatePetRecord).not.toHaveBeenCalled();
    });

    it('should reject an empty owner name', async () => {
      const [firstPet] = PET_FIXTURES;
      if (!firstPet) {
        throw new Error('Expected at least one pet fixture');
      }

      const res = await request(app)
        .patch(`/api/admin/pets/${firstPet.id}`)
        .send({ type: 'Dog', gender: 'Male', age: 3, ownerName: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});

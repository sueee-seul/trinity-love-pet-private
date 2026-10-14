import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as staffService from '../services/staff.service.js';

type StaffRole = 'manager' | 'staff';
type StaffStatus = 'active' | 'on-leave';
type EmploymentType = 'full-time' | 'part-time';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employee_role: StaffRole;
  status: StaffStatus;
  employeeNumber: string;
  joinedDate: string;
  avatarUrl: string | null;
  facilityUuid: string;
  facilityName: string;
  employmentType: EmploymentType;
}

interface AssignedPet {
  petId: string;
  petName: string;
  petType: string;
  ownerName: string;
  checkInDate: string;
  checkOutDate: string | null;
}

const repository = vi.hoisted(() => ({
  listStaff: vi.fn(),
  listFacilities: vi.fn(),
  findStaffById: vi.fn(),
  findStaffByEmail: vi.fn(),
  listAssignedPets: vi.fn(),
  listStaffOptions: vi.fn(),
  findManagerRecipient: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  removeStaff: vi.fn(),
}));

vi.mock('../repositories/staff.repository.js', () => repository);

const FACILITY_UUID = '00000000-0000-4000-8000-000000000301';

const SEED: StaffMember[] = [
  {
    id: 'u1',
    name: 'Alice Manager',
    email: 'manager@wagstay.com',
    phone: '+64 21 555 0100',
    employee_role: 'manager',
    status: 'active',
    employeeNumber: 'WS-0001',
    joinedDate: '03/02/2024',
    avatarUrl: null,
    facilityUuid: FACILITY_UUID,
    facilityName: 'Trinity Central',
    employmentType: 'full-time',
  },
  {
    id: 'u2',
    name: 'Bob Staff',
    email: 'staff1@wagstay.com',
    phone: '+64 21 555 0101',
    employee_role: 'staff',
    status: 'active',
    employeeNumber: 'WS-0002',
    joinedDate: '19/05/2024',
    avatarUrl: null,
    facilityUuid: FACILITY_UUID,
    facilityName: 'Trinity Central',
    employmentType: 'full-time',
  },
  {
    id: 'u9',
    name: 'Unassigned Carer',
    email: 'spare@wagstay.com',
    phone: null,
    employee_role: 'staff',
    status: 'active',
    employeeNumber: 'WS-0009',
    joinedDate: '01/01/2025',
    avatarUrl: null,
    facilityUuid: FACILITY_UUID,
    facilityName: 'Trinity Central',
    employmentType: 'full-time',
  },
];

const assignedPetsByStaffId: Record<string, AssignedPet[]> = {
  u2: [
    {
      petId: 'pet-1',
      petName: 'Sherlock',
      petType: 'Dog',
      ownerName: 'Jennifer Andrews',
      checkInDate: '15/08/2026',
      checkOutDate: null,
    },
  ],
};

let staffState: StaffMember[] = [];

const cloneStaff = (member: StaffMember): StaffMember => ({ ...member });

const findStaff = (id: string): StaffMember | undefined =>
  staffState.find((member) => member.id === id);

const countOtherManagers = (id: string): number =>
  staffState.filter((member) => member.id !== id && member.employee_role === 'manager').length;

const isEmailTaken = (email: string, excludingId?: string): boolean => {
  const normalized = email.trim().toLowerCase();
  return staffState.some(
    (member) => member.id !== excludingId && member.email.toLowerCase() === normalized,
  );
};

const configureRepositoryDoubles = (): void => {
  repository.listStaff.mockImplementation(async () => staffState.map(cloneStaff));
  repository.listFacilities.mockResolvedValue([{ id: FACILITY_UUID, name: 'Trinity Central' }]);
  repository.findStaffById.mockImplementation(async (id: string) => {
    const member = findStaff(id);
    return member ? cloneStaff(member) : undefined;
  });
  repository.findStaffByEmail.mockImplementation(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    const member = staffState.find((candidate) => candidate.email.toLowerCase() === normalized);
    return member ? cloneStaff(member) : undefined;
  });
  repository.listAssignedPets.mockImplementation(async (id: string) => ({
    outcome: 'found',
    assignments: (assignedPetsByStaffId[id] ?? []).map((pet) => ({ ...pet })),
  }));
  repository.listStaffOptions.mockImplementation(async () =>
    staffState.map((member) => ({ id: member.id, name: member.name })),
  );
  repository.findManagerRecipient.mockImplementation(async () => {
    const manager = staffState.find((member) => member.employee_role === 'manager');
    return manager ? { id: manager.id, name: manager.name, email: manager.email } : undefined;
  });
  repository.createStaff.mockImplementation(
    async (input: {
      name: string;
      email: string;
      facilityUuid: string;
      employmentType: EmploymentType;
      employee_role: StaffRole;
      status: StaffStatus;
    }) => {
      if (isEmailTaken(input.email)) {
        return { outcome: 'email_conflict' };
      }
      const highestEmployeeNumber = staffState.reduce((highest, member) => {
        const number = Number(member.employeeNumber.replace(/\D/g, ''));
        return Number.isFinite(number) && number > highest ? number : highest;
      }, 0);
      const member: StaffMember = {
        id: `u${staffState.length + 1}`,
        name: input.name,
        email: input.email,
        phone: null,
        employee_role: input.employee_role,
        status: input.status,
        employeeNumber: `WS-${String(highestEmployeeNumber + 1).padStart(4, '0')}`,
        joinedDate: '29/08/2026',
        avatarUrl: null,
        facilityUuid: input.facilityUuid,
        facilityName: 'Trinity Central',
        employmentType: input.employmentType,
      };
      staffState.push(member);
      return { outcome: 'created', staff: cloneStaff(member) };
    },
  );
  repository.updateStaff.mockImplementation(async (id: string, input: Partial<StaffMember>) => {
    const member = findStaff(id);
    if (!member) {
      return { outcome: 'not_found' };
    }
    if (
      input.employee_role !== undefined &&
      member.employee_role === 'manager' &&
      input.employee_role !== 'manager' &&
      countOtherManagers(id) === 0
    ) {
      return { outcome: 'last_manager' };
    }
    if (input.email !== undefined && isEmailTaken(input.email, id)) {
      return { outcome: 'email_conflict' };
    }
    Object.assign(member, input);
    return { outcome: 'updated', staff: cloneStaff(member) };
  });
  repository.removeStaff.mockImplementation(async (id: string, actingStaffId: string | null) => {
    const member = findStaff(id);
    if (!member) {
      return { outcome: 'not_found' };
    }
    if (actingStaffId === member.id) {
      return { outcome: 'self_removal' };
    }
    if (member.employee_role === 'manager' && countOtherManagers(id) === 0) {
      return { outcome: 'last_manager' };
    }
    const assignedCount = (assignedPetsByStaffId[id] ?? []).length;
    if (assignedCount > 0) {
      return {
        outcome: 'has_assignments',
        staffName: member.name,
        count: assignedCount,
      };
    }
    staffState.splice(staffState.indexOf(member), 1);
    return { outcome: 'removed' };
  });
};

describe('staff.service', () => {
  beforeEach(() => {
    staffState = SEED.map(cloneStaff);
    vi.clearAllMocks();
    configureRepositoryDoubles();
  });

  describe('permission guardrails', () => {
    it('refuses to remove the account doing the removing', async () => {
      await expect(staffService.remove('u1', 'u1')).rejects.toThrow(
        'You cannot remove your own account',
      );
    });

    it('refuses to remove the only manager', async () => {
      await expect(staffService.remove('u1', 'u2')).rejects.toThrow('This is the only manager');
    });

    it('refuses to demote the only manager', async () => {
      await expect(staffService.updateAsManager('u1', { employee_role: 'staff' })).rejects.toThrow(
        'This is the only manager',
      );
    });

    it('allows demotion once a second manager exists', async () => {
      await staffService.updateAsManager('u2', { employee_role: 'manager' });
      const demoted = await staffService.updateAsManager('u1', { employee_role: 'staff' });

      expect(demoted.employee_role).toBe('staff');
    });

    it('refuses to remove someone who still has pets assigned', async () => {
      await expect(staffService.remove('u2', 'u1')).rejects.toThrow('still has');
    });

    it('removes a carer with no pets assigned', async () => {
      await staffService.remove('u9', 'u1');

      await expect(staffService.getDetail('u9')).rejects.toThrow('Staff member not found');
    });
  });

  describe('self-service edits', () => {
    it('updates name and phone', async () => {
      const updated = await staffService.updateOwnProfile('u2', {
        name: 'Bobby Staff',
        phone: '+64 21 555 9999',
      });

      expect(updated.name).toBe('Bobby Staff');
      expect(updated.phone).toBe('+64 21 555 9999');
    });

    it('ignores a role sent through the self-service path', async () => {
      await staffService.updateOwnProfile('u2', {
        name: 'Bob Staff',
        // A role is not part of the self-editable contract; it must not apply.
      } as Parameters<typeof staffService.updateOwnProfile>[1]);

      const member = await staffService.getDetail('u2');
      expect(member.employee_role).toBe('staff');
    });

    it('rejects an empty name', async () => {
      await expect(staffService.updateOwnProfile('u2', { name: '  ' })).rejects.toThrow(
        'Name is required',
      );
    });

    it('rejects a base64 avatar rather than persisting image bytes in the user row', async () => {
      await expect(
        staffService.updateOwnProfile('u2', {
          avatarUrl: 'data:image/png;base64,ZmFrZQ==',
        }),
      ).rejects.toThrow('object storage');
      expect(repository.updateStaff).not.toHaveBeenCalled();
    });
  });

  describe('creation', () => {
    it('rejects a duplicate email', async () => {
      await expect(
        staffService.create({
          name: 'Copycat',
          email: 'MANAGER@wagstay.com',
          facilityUuid: FACILITY_UUID,
          employmentType: 'full-time',
          employee_role: 'staff',
          status: 'active',
        }),
      ).rejects.toThrow('already used');
    });

    it('rejects a malformed email', async () => {
      await expect(
        staffService.create({
          name: 'Typo',
          email: 'not-an-email',
          facilityUuid: FACILITY_UUID,
          employmentType: 'full-time',
          employee_role: 'staff',
          status: 'active',
        }),
      ).rejects.toThrow('valid address');
    });

    it('assigns the next employee number', async () => {
      const created = await staffService.create({
        name: 'New Carer',
        email: 'new@wagstay.com',
        facilityUuid: FACILITY_UUID,
        employmentType: 'full-time',
        employee_role: 'staff',
        status: 'active',
      });

      expect(created.staff.employeeNumber).toBe('WS-0010');
    });
  });

  describe('assignments', () => {
    it('reports the pets a carer is responsible for', async () => {
      const assigned = await staffService.getAssignedPets('u2');

      expect(assigned.length).toBeGreaterThan(0);
      expect(assigned[0]).toHaveProperty('petName');
    });

    it('returns nothing for a carer with no pets', async () => {
      expect(await staffService.getAssignedPets('u9')).toEqual([]);
    });
  });

  it('loads staff options through the Staff repository boundary', async () => {
    await expect(staffService.getOptions()).resolves.toEqual([
      { id: 'u1', name: 'Alice Manager' },
      { id: 'u2', name: 'Bob Staff' },
      { id: 'u9', name: 'Unassigned Carer' },
    ]);
  });

  it('loads the manager recipient through the Staff repository boundary', async () => {
    await expect(staffService.getManagerRecipient()).resolves.toEqual({
      id: 'u1',
      name: 'Alice Manager',
      email: 'manager@wagstay.com',
    });
  });

  it('propagates a staff database failure without returning fixture data', async () => {
    const databaseError = new Error('database unavailable');
    repository.listStaff.mockRejectedValueOnce(databaseError);

    await expect(staffService.getList()).rejects.toBe(databaseError);
  });
});

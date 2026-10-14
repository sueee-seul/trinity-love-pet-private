import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as staffService from '../services/staff.service.js';

const repository = vi.hoisted(() => ({
  createStaff: vi.fn(),
  findStaffByEmail: vi.fn(),
  findStaffById: vi.fn(),
  listAssignedPets: vi.fn(),
  listFacilities: vi.fn(),
  listStaff: vi.fn(),
  removeStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

vi.mock('../repositories/staff.repository.js', () => repository);

const createdStaff = {
  id: '00000000-0000-4000-8000-000000000901',
  name: 'New Carer',
  email: 'new.carer@example.test',
  phone: null,
  employee_role: 'staff' as const,
  status: 'active' as const,
  employeeNumber: 'WS-0009',
  joinedDate: '27/08/2026',
  avatarUrl: null,
  facilityUuid: '00000000-0000-4000-8000-000000000301',
  facilityName: 'Trinity Central',
  employmentType: 'full-time' as const,
};

describe('staff account provisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.createStaff.mockResolvedValue({ outcome: 'created', staff: createdStaff });
  });

  it('generates a temporary password and keeps it separate from the staff projection', async () => {
    const result = await staffService.create({
      name: createdStaff.name,
      email: createdStaff.email,
      facilityUuid: createdStaff.facilityUuid,
      employmentType: createdStaff.employmentType,
      employee_role: createdStaff.employee_role,
      status: createdStaff.status,
    });

    expect(result.staff).toEqual(createdStaff);
    expect(result.temporaryPassword).toMatch(/[A-Z]/);
    expect(result.temporaryPassword).toMatch(/[a-z]/);
    expect(result.temporaryPassword).toMatch(/\d/);
    expect(result.temporaryPassword).toMatch(/[^A-Za-z0-9\s]/);
    expect(result.staff).not.toHaveProperty('temporaryPassword');
    expect(repository.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        email: createdStaff.email,
        facilityUuid: createdStaff.facilityUuid,
        employmentType: createdStaff.employmentType,
        temporaryPassword: result.temporaryPassword,
      }),
    );
  });
});

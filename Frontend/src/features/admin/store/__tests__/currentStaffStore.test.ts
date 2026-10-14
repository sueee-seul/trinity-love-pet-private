import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentStaffStore } from '../currentStaffStore';
import type { User } from '../../../../shared/auth/store/authStore';
import type { AssignedPet, StaffMember } from '../../types/staff';

const { fetchStaffById, fetchStaffByEmail, fetchStaffAssignments, updateOwnStaffProfile } =
  vi.hoisted(() => ({
    fetchStaffById: vi.fn(),
    fetchStaffByEmail: vi.fn(),
    fetchStaffAssignments: vi.fn(),
    updateOwnStaffProfile: vi.fn(),
  }));

vi.mock('../../api/staffApi', () => ({
  StaffApiError: class StaffApiError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  fetchStaffById,
  fetchStaffByEmail,
  fetchStaffAssignments,
  updateOwnStaffProfile,
}));

const MANAGER: StaffMember = {
  id: 'staff-1',
  name: 'Alice Manager',
  username: 'test.user',
  email: 'manager@wagstay.com',
  phone: null,
  employee_role: 'manager',
  status: 'active',
  employeeNumber: 'WS-0001',
  joinedDate: '03/02/2024',
  avatarUrl: null,
  facilityUuid: 'facility-1',
  facilityName: 'Trinity Central',
  employmentType: 'full-time',
  title: null,
  shiftDetails: null,
};

const STAFF: StaffMember = {
  ...MANAGER,
  id: 'staff-2',
  name: 'Bob Staff',
  email: 'staff@wagstay.com',
  employee_role: 'staff',
};

const ASSIGNMENTS: AssignedPet[] = [
  {
    petId: 'pet-1',
    petName: 'Sherlock',
    petType: 'Dog',
    ownerName: 'Jennifer Andrews',
    checkInDate: '15/08/2026',
    checkOutDate: null,
  },
];

const userFor = (member: StaffMember): User => ({
  id: member.id,
  email: member.email,
  name: member.name,
  is_employee: true,
  is_pet_owner: false,
  employee_role: member.employee_role,
});

const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

beforeEach(() => {
  useCurrentStaffStore.getState().clear();
  vi.clearAllMocks();
  fetchStaffAssignments.mockResolvedValue(ASSIGNMENTS);
});

describe('currentStaffStore', () => {
  it('deduplicates concurrent hydration for the same identity', async () => {
    const profile = deferred<StaffMember>();
    fetchStaffById.mockReturnValue(profile.promise);

    const first = useCurrentStaffStore.getState().hydrate(userFor(MANAGER));
    const second = useCurrentStaffStore.getState().hydrate(userFor(MANAGER));

    expect(second).toBe(first);
    expect(fetchStaffById).toHaveBeenCalledTimes(1);

    profile.resolve(MANAGER);
    await first;
    expect(useCurrentStaffStore.getState().profileStatus).toBe('ready');
    expect(useCurrentStaffStore.getState().staff).toEqual(MANAGER);
  });

  it('uses email only for a legacy bootstrap and keeps the returned id as the key', async () => {
    fetchStaffByEmail.mockResolvedValue(MANAGER);

    await useCurrentStaffStore.getState().hydrate({
      email: MANAGER.email,
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'manager',
    });

    expect(fetchStaffByEmail).toHaveBeenCalledWith(MANAGER.email);
    expect(fetchStaffById).not.toHaveBeenCalled();
    expect(useCurrentStaffStore.getState().identityKey).toBe(MANAGER.id);
  });

  it('deduplicates a repeated hydrate when auth UUID and staff id differ', async () => {
    const authUser: User = {
      id: 'auth-user-uuid',
      email: MANAGER.email,
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'manager',
    };
    const returnedStaff = { ...MANAGER, id: 'u1' };
    fetchStaffById.mockResolvedValue(returnedStaff);

    await useCurrentStaffStore.getState().hydrate(authUser);
    await useCurrentStaffStore.getState().hydrate(authUser);

    expect(fetchStaffById).toHaveBeenCalledTimes(1);
    expect(useCurrentStaffStore.getState().identityKey).toBe('u1');
    expect(useCurrentStaffStore.getState().authIdentityKey).toBe('id:auth-user-uuid');
  });

  it('ignores stale profile and assignment results after identity change or logout', async () => {
    const firstProfile = deferred<StaffMember>();
    const secondProfile = deferred<StaffMember>();
    fetchStaffById.mockImplementation((id: string) =>
      id === MANAGER.id ? firstProfile.promise : secondProfile.promise,
    );
    const firstAssignments = deferred<AssignedPet[]>();
    fetchStaffAssignments.mockImplementation((id: string) =>
      id === MANAGER.id ? firstAssignments.promise : Promise.resolve([]),
    );

    const first = useCurrentStaffStore.getState().hydrate(userFor(MANAGER));
    const second = useCurrentStaffStore.getState().hydrate(userFor(STAFF));
    secondProfile.resolve(STAFF);
    await second;
    await Promise.resolve();

    firstProfile.resolve(MANAGER);
    await first;
    firstAssignments.resolve(ASSIGNMENTS);
    await Promise.resolve();

    expect(useCurrentStaffStore.getState().staff).toEqual(STAFF);
    expect(useCurrentStaffStore.getState().assignments).toEqual([]);

    const loggedOutProfile = deferred<StaffMember>();
    fetchStaffById.mockReturnValue(loggedOutProfile.promise);
    const loggedOutHydration = useCurrentStaffStore.getState().hydrate(userFor(MANAGER));
    useCurrentStaffStore.getState().clear();
    loggedOutProfile.resolve(MANAGER);
    await loggedOutHydration;

    expect(useCurrentStaffStore.getState().staff).toBeNull();
    expect(useCurrentStaffStore.getState().assignments).toEqual([]);
    expect(useCurrentStaffStore.getState().profileStatus).toBe('idle');
  });

  it('publishes profile readiness before assignments finish', async () => {
    fetchStaffById.mockResolvedValue(MANAGER);
    const assignments = deferred<AssignedPet[]>();
    fetchStaffAssignments.mockReturnValue(assignments.promise);

    await useCurrentStaffStore.getState().hydrate(userFor(MANAGER));

    expect(useCurrentStaffStore.getState().profileStatus).toBe('ready');
    expect(useCurrentStaffStore.getState().staff).toEqual(MANAGER);
    expect(useCurrentStaffStore.getState().assignmentStatus).toBe('loading');
    expect(useCurrentStaffStore.getState().assignments).toEqual([]);

    assignments.resolve(ASSIGNMENTS);
    await Promise.resolve();
    expect(useCurrentStaffStore.getState().assignmentStatus).toBe('ready');
    expect(useCurrentStaffStore.getState().assignments).toEqual(ASSIGNMENTS);
  });

  it('updates the canonical profile once after a successful self edit', async () => {
    const updated = { ...MANAGER, name: 'Alice Updated' };
    fetchStaffById.mockResolvedValue(MANAGER);
    updateOwnStaffProfile.mockResolvedValue(updated);

    await useCurrentStaffStore.getState().hydrate(userFor(MANAGER));
    const saved = await useCurrentStaffStore.getState().saveProfile({ name: updated.name });

    expect(saved).toBe(true);
    expect(updateOwnStaffProfile).toHaveBeenCalledTimes(1);
    expect(useCurrentStaffStore.getState().staff).toEqual(updated);
  });

  it('clears the full snapshot and errors idempotently', async () => {
    fetchStaffById.mockResolvedValue(MANAGER);
    await useCurrentStaffStore.getState().hydrate(userFor(MANAGER));
    await Promise.resolve();
    useCurrentStaffStore.setState({ profileError: 'old error', saveError: 'old save error' });

    useCurrentStaffStore.getState().clear();
    useCurrentStaffStore.getState().clear();

    expect(useCurrentStaffStore.getState()).toMatchObject({
      identityKey: null,
      authIdentityKey: null,
      profileStatus: 'idle',
      assignmentStatus: 'idle',
      staff: null,
      assignments: [],
      profileError: null,
      assignmentError: null,
      saveError: null,
      saving: false,
    });
    expect(updateOwnStaffProfile).not.toHaveBeenCalled();
    expect(fetchStaffByEmail).not.toHaveBeenCalled();
  });
});

import React, { useMemo, useState } from 'react';
import { StaffDirectory } from '../components/profile/StaffDirectory';
import { StaffEditModal } from '../components/profile/StaffEditModal';
import { StaffAssignmentsModal } from '../components/profile/StaffAssignmentsModal';
import { useStaffDirectory } from '../hooks/useStaffDirectory';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { AdminPage } from '../components/layout/AdminPage';
import type {
  StaffCreateInput,
  StaffCreateResult,
  StaffManagedEdit,
  StaffMember,
} from '../types/staff';

type EditTarget = { mode: 'add' } | { mode: 'edit'; member: StaffMember } | null;

export const AdminTeamPage: React.FC = () => {
  const directory = useStaffDirectory();
  const staff = useCurrentStaffStore((state) => state.staff);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [assignmentsTarget, setAssignmentsTarget] = useState<StaffMember | null>(null);

  const managerCount = useMemo(
    () => directory.staff.filter((member) => member.employee_role === 'manager').length,
    [directory.staff],
  );

  const editingMember = editTarget?.mode === 'edit' ? editTarget.member : null;
  const isOnlyManager = editingMember?.employee_role === 'manager' && managerCount <= 1;

  const handleSubmit = async (
    values: StaffCreateInput | StaffManagedEdit,
  ): Promise<StaffCreateResult | StaffMember | null> => {
    if (editTarget?.mode === 'edit') {
      if ('name' in values) {
        return directory.editStaff(editTarget.member.id, {
          email: values.email,
          facilityUuid: values.facilityUuid,
          employmentType: values.employmentType,
          employee_role: values.employee_role,
          status: values.status,
        });
      }
      return directory.editStaff(editTarget.member.id, values);
    }
    if ('name' in values) {
      return directory.addStaff(values);
    }
    return null;
  };

  const handleRemove = async (member: StaffMember): Promise<void> => {
    if (!staff) {
      return;
    }
    await directory.removeStaff(member.id);
  };

  const closeEditor = (): void => {
    setEditTarget(null);
    directory.clearActionError();
  };

  if (!staff) {
    return null;
  }

  return (
    <AdminPage width="standard">
      <header>
        <h1 className="type-display text-theme-earth">Team management</h1>
        <p className="mt-2 type-body text-notice-secondary">
          Manage staff accounts, roles, and pet assignments.
        </p>
      </header>
      <StaffDirectory
        staff={directory.staff}
        loading={directory.loading}
        errorMessage={directory.error}
        actionError={directory.actionError}
        pendingId={directory.pendingId}
        currentStaffId={staff.id}
        managerCount={managerCount}
        onAdd={() => setEditTarget({ mode: 'add' })}
        onEdit={(member) => setEditTarget({ mode: 'edit', member })}
        onViewAssignments={setAssignmentsTarget}
        onRemove={handleRemove}
      />

      <StaffEditModal
        isOpen={editTarget !== null}
        staff={editingMember}
        saving={directory.pendingId !== null}
        errorMessage={directory.actionError}
        isOnlyManager={isOnlyManager}
        options={directory.options}
        optionsLoading={directory.optionsLoading}
        optionsError={directory.optionsError}
        onClose={closeEditor}
        onSubmit={handleSubmit}
      />

      <StaffAssignmentsModal
        isOpen={assignmentsTarget !== null}
        staff={assignmentsTarget}
        onClose={() => setAssignmentsTarget(null)}
      />
    </AdminPage>
  );
};

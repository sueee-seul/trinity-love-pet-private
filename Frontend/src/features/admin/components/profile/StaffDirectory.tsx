import React, { useMemo, useState } from 'react';
import { StaffRoleBadge, StaffStatusBadge } from './StaffBadges';
import type { StaffMember } from '../../types/staff';

interface StaffDirectoryProps {
  staff: StaffMember[];
  loading: boolean;
  errorMessage: string | null;
  actionError: string | null;
  pendingId: string | null;
  currentStaffId: string;
  managerCount: number;
  onAdd: () => void;
  onEdit: (member: StaffMember) => void;
  onViewAssignments: (member: StaffMember) => void;
  onRemove: (member: StaffMember) => void;
}

interface RemovalBlock {
  blocked: boolean;
  reason: string;
}

/**
 * The two rules that cannot be undone from inside the product: an account
 * removing itself, and the last manager disappearing. Both are surfaced as a
 * disabled control with the reason next to it rather than a silent failure.
 */
const removalBlockFor = (
  member: StaffMember,
  currentStaffId: string,
  managerCount: number,
): RemovalBlock => {
  if (member.id === currentStaffId) {
    return { blocked: true, reason: 'You cannot remove your own account.' };
  }
  if (member.employee_role === 'manager' && managerCount <= 1) {
    return { blocked: true, reason: 'This is the only manager.' };
  }
  return { blocked: false, reason: '' };
};

const actionClass =
  'cursor-pointer rounded-full px-3 py-1.5 type-button transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  staff,
  loading,
  errorMessage,
  actionError,
  pendingId,
  currentStaffId,
  managerCount,
  onAdd,
  onEdit,
  onViewAssignments,
  onRemove,
}) => {
  const [query, setQuery] = useState('');

  const visibleStaff = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return staff;
    }
    return staff.filter((member) =>
      [member.name, member.email, member.employee_role, member.employeeNumber]
        .join(' ')
        .toLowerCase()
        .includes(trimmed),
    );
  }, [staff, query]);

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="type-card-title">Team members</h2>
          <p className="type-meta mt-1">Only managers can add, edit or remove staff accounts.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-2.5 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover"
        >
          Add staff member
        </button>
      </div>

      <label className="block">
        <span className="sr-only">Search the team</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email or employee role"
          className="w-full rounded-full border border-field-border bg-surface-cream px-5 py-2.5 type-body focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </label>

      {actionError && (
        <p role="alert" className="mt-4 type-body text-status-danger">
          {actionError}
        </p>
      )}

      {loading && <p className="mt-6 type-body text-notice-muted">Loading the team…</p>}

      {!loading && errorMessage && (
        <p role="alert" className="mt-6 type-body text-status-danger">
          {errorMessage}
        </p>
      )}

      {!loading && !errorMessage && visibleStaff.length === 0 && (
        <p className="mt-6 type-body text-notice-muted">
          {query.trim() ? 'No one matches your search.' : 'No staff accounts yet.'}
        </p>
      )}

      {!loading && !errorMessage && visibleStaff.length > 0 && (
        <ul className="mt-2 divide-y divide-border-soft">
          {visibleStaff.map((member) => {
            const block = removalBlockFor(member, currentStaffId, managerCount);
            const isPending = pendingId === member.id;

            return (
              <li key={member.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
                <div className="min-w-52 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="type-body font-medium">{member.name}</p>
                    <StaffRoleBadge employee_role={member.employee_role} />
                    <StaffStatusBadge status={member.status} />
                    {member.id === currentStaffId && <span className="type-meta">(you)</span>}
                  </div>
                  <p className="type-meta mt-0.5 break-words">
                    {member.email} · {member.employeeNumber}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewAssignments(member)}
                    className={`${actionClass} border border-border-soft text-notice-secondary hover:bg-surface-cream`}
                  >
                    Pets
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(member)}
                    disabled={isPending}
                    className={`${actionClass} border border-control-border text-accent-foreground hover:bg-surface-cream`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(member)}
                    disabled={block.blocked || isPending}
                    title={block.blocked ? block.reason : undefined}
                    className={`${actionClass} text-status-danger hover:bg-status-danger/10`}
                  >
                    {isPending ? 'Working…' : 'Remove'}
                  </button>
                </div>

                {block.blocked && (
                  <p className="type-meta w-full sm:w-auto sm:basis-full">{block.reason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

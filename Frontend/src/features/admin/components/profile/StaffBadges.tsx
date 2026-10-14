import React from 'react';
import {
  STAFF_ROLE_LABELS,
  STAFF_STATUS_LABELS,
  type StaffRole,
  type StaffStatus,
} from '../../types/staff';

/**
 * A manager badge earns the strongest treatment on the page because it is the
 * only visual signal that this account can change other people's access.
 */
const ROLE_CLASSES: Record<StaffRole, string> = {
  manager: 'bg-action-dark text-on-action-dark',
  staff: 'bg-surface-bubbles text-theme-earth',
};

const STATUS_CLASSES: Record<StaffStatus, string> = {
  active: 'bg-status-success/12 text-status-success',
  'on-leave': 'bg-surface-deep text-notice-secondary',
};

export const StaffRoleBadge: React.FC<{ employee_role: StaffRole }> = ({ employee_role }) => {
  return (
    <span className={`rounded-full px-3 py-1 type-eyebrow ${ROLE_CLASSES[employee_role]}`}>
      {STAFF_ROLE_LABELS[employee_role]}
    </span>
  );
};

export const StaffStatusBadge: React.FC<{ status: StaffStatus }> = ({ status }) => {
  return (
    <span className={`rounded-full px-3 py-1 type-eyebrow ${STATUS_CLASSES[status]}`}>
      {STAFF_STATUS_LABELS[status]}
    </span>
  );
};

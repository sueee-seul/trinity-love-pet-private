import React, { useState } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal';
import {
  EMPLOYMENT_TYPES,
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  STAFF_STATUSES,
  STAFF_STATUS_LABELS,
  type EmploymentType,
  type StaffCreateInput,
  type StaffCreateResult,
  type StaffManagementOptions,
  type StaffManagedEdit,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from '../../types/staff';

interface StaffEditModalProps {
  isOpen: boolean;
  /** null means the modal is creating someone new. */
  staff: StaffMember | null;
  saving: boolean;
  errorMessage: string | null;
  /** Blocks demoting the last manager before the request is even sent. */
  isOnlyManager: boolean;
  options: StaffManagementOptions;
  optionsLoading: boolean;
  optionsError?: string | null;
  onClose: () => void;
  onSubmit: (
    values: StaffCreateInput | StaffManagedEdit,
  ) => Promise<StaffCreateResult | StaffMember | null>;
}

const fieldClass =
  'w-full rounded-xl border border-field-border bg-surface-cream px-4 py-2.5 type-body ' +
  'focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus';

type StaffSubmitResult = StaffCreateResult | StaffMember | null;

const isStaffCreateResult = (result: StaffSubmitResult): result is StaffCreateResult => {
  return Boolean(result && 'temporaryPassword' in result);
};

interface CredentialRevealProps {
  staff: StaffMember;
  temporaryPassword: string;
  onClose: () => void;
}

const CredentialReveal: React.FC<CredentialRevealProps> = ({
  staff,
  temporaryPassword,
  onClose,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);

  const copyValue = async (field: 'email' | 'password', value: string): Promise<void> => {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <div className="p-8">
      <h3 className="type-card-title">Account created</h3>
      <p className="type-meta mt-1">
        Give these sign-in details to {staff.name}. They must change the password on their first
        sign-in.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <p className="type-eyebrow text-notice-muted">Sign-in email</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 break-words type-body">{staff.email}</p>
            <button
              type="button"
              onClick={() => void copyValue('email', staff.email)}
              className="shrink-0 rounded-full border border-control-border px-3 py-1.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
            >
              {copiedField === 'email' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <p className="type-eyebrow text-notice-muted">Temporary password</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-surface-cream px-4 py-2.5 type-body tracking-wide">
              {showPassword ? temporaryPassword : '••••••••••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
              className="shrink-0 rounded-full border border-border-soft px-3 py-1.5 type-button text-notice-secondary transition-colors hover:bg-surface-cream"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              onClick={() => void copyValue('password', temporaryPassword)}
              aria-label="Copy temporary password"
              className="shrink-0 rounded-full border border-control-border px-3 py-1.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
            >
              {copiedField === 'password' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-5 rounded-xl bg-surface-deep/60 px-4 py-3 type-meta text-notice-secondary">
        This temporary password will not be shown again after this window is closed.
      </p>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-2.5 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover"
        >
          Done
        </button>
      </div>
    </div>
  );
};

interface StaffEditFormProps {
  staff: StaffMember | null;
  saving: boolean;
  errorMessage: string | null;
  isOnlyManager: boolean;
  options: StaffManagementOptions;
  optionsLoading: boolean;
  optionsError?: string | null;
  onClose: () => void;
  onSubmit: (
    values: StaffCreateInput | StaffManagedEdit,
  ) => Promise<StaffCreateResult | StaffMember | null>;
}

const StaffEditForm: React.FC<StaffEditFormProps> = ({
  staff,
  saving,
  errorMessage,
  isOnlyManager,
  options,
  optionsLoading,
  optionsError,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [facilityUuid, setFacilityUuid] = useState(
    staff?.facilityUuid ?? options.facilities[0]?.id ?? '',
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    staff?.employmentType ?? options.employmentTypes[0] ?? EMPLOYMENT_TYPES[0],
  );
  const [employeeRole, setEmployeeRole] = useState<StaffRole>(staff?.employee_role ?? 'staff');
  const [title, setTitle] = useState(staff?.title ?? '');
  const [shiftDetails, setShiftDetails] = useState(staff?.shiftDetails ?? '');
  const [status, setStatus] = useState<StaffStatus>(staff?.status ?? 'active');
  const [createdAccount, setCreatedAccount] = useState<StaffCreateResult | null>(null);

  if (createdAccount) {
    return (
      <CredentialReveal
        staff={createdAccount.staff}
        temporaryPassword={createdAccount.temporaryPassword}
        onClose={onClose}
      />
    );
  }

  const canSubmit =
    email.trim().length > 0 &&
    facilityUuid.length > 0 &&
    employmentType.length > 0 &&
    (!staff ? name.trim().length > 0 : true) &&
    !saving &&
    !optionsLoading;

  const handleSubmit = async (): Promise<void> => {
    const values: StaffCreateInput | StaffManagedEdit = staff
      ? {
          email: email.trim(),
          facilityUuid,
          employmentType,
          employee_role: employeeRole,
          status,
          title: title.trim() || null,
          shiftDetails: shiftDetails.trim() || null,
        }
      : {
          name: name.trim(),
          email: email.trim(),
          facilityUuid,
          employmentType,
          employee_role: employeeRole,
          status,
        };

    const result = await onSubmit(values);
    if (!result) {
      return;
    }

    if (!staff && isStaffCreateResult(result)) {
      setCreatedAccount(result);
      return;
    }

    if (staff) {
      onClose();
    }
  };

  return (
    <div className="p-8">
      <h3 className="type-card-title">
        {staff ? 'Employee account settings' : 'Create employee account'}
      </h3>
      <p className="type-meta mt-1">
        {staff
          ? 'Managers control account and employment settings. Personal profile details are managed by the employee.'
          : 'The system will generate a temporary password that the employee must change on first sign-in.'}
      </p>

      {!staff && (
        <section className="mt-6">
          <h4 className="type-eyebrow text-notice-muted">Initial account information</h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="type-eyebrow text-notice-muted">Full name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`mt-1.5 ${fieldClass}`}
              />
            </label>
            <label className="block">
              <span className="type-eyebrow text-notice-muted">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`mt-1.5 ${fieldClass}`}
              />
            </label>
          </div>
        </section>
      )}

      {staff && (
        <section className="mt-6 rounded-2xl bg-surface-cream/70 p-4">
          <h4 className="type-eyebrow text-notice-muted">Personal profile</h4>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="type-eyebrow text-notice-muted">Full name</dt>
              <dd className="type-body">{staff.name}</dd>
            </div>
            <div>
              <dt className="type-eyebrow text-notice-muted">Phone</dt>
              <dd className="type-body">{staff.phone ?? 'Not added'}</dd>
            </div>
            <div>
              <dt className="type-eyebrow text-notice-muted">Employee number</dt>
              <dd className="type-body">{staff.employeeNumber}</dd>
            </div>
            <div>
              <dt className="type-eyebrow text-notice-muted">Joined</dt>
              <dd className="type-body">{staff.joinedDate}</dd>
            </div>
          </dl>
          <p className="mt-3 type-meta">Personal profile details are managed by the employee.</p>
        </section>
      )}

      <section className="mt-6">
        <h4 className="type-eyebrow text-notice-muted">
          {staff ? 'Account settings' : 'Employment setup'}
        </h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {staff && (
            <label className="block">
              <span className="type-eyebrow text-notice-muted" id="staff-work-email-label">
                Work email
              </span>
              <input
                aria-labelledby="staff-work-email-label"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`mt-1.5 ${fieldClass}`}
              />
            </label>
          )}

          <label className="block">
            <span className="type-eyebrow text-notice-muted" id="staff-facility-label">
              Facility
            </span>
            <select
              id="staff-facility"
              aria-labelledby="staff-facility-label"
              value={facilityUuid}
              onChange={(event) => setFacilityUuid(event.target.value)}
              disabled={optionsLoading || options.facilities.length === 0}
              className={`mt-1.5 ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">
                {optionsLoading ? 'Loading facilities…' : 'Select a facility'}
              </option>
              {options.facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="type-eyebrow text-notice-muted" id="staff-employment-type-label">
              Employment type
            </span>
            <select
              id="staff-employment-type"
              aria-labelledby="staff-employment-type-label"
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}
              disabled={optionsLoading || options.employmentTypes.length === 0}
              className={`mt-1.5 ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {options.employmentTypes.length === 0 && <option value="">Select a type</option>}
              {options.employmentTypes.map((value) => (
                <option key={value} value={value}>
                  {value === 'full-time' ? 'Full-time' : 'Part-time'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="type-eyebrow text-notice-muted">Job title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Grooming Specialist"
              className={`mt-1.5 ${fieldClass}`}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="type-eyebrow text-notice-muted">Shift details</span>
            <input
              value={shiftDetails}
              onChange={(event) => setShiftDetails(event.target.value)}
              placeholder="e.g. Tuesday to Saturday, 08:00 to 16:00"
              className={`mt-1.5 ${fieldClass}`}
            />
          </label>

          <label className="block">
            <span className="type-eyebrow text-notice-muted" id="staff-employee-role-label">
              Employee role
            </span>
            <select
              id="staff-employee-role"
              aria-labelledby="staff-employee-role-label"
              value={employeeRole}
              onChange={(event) => setEmployeeRole(event.target.value as StaffRole)}
              disabled={isOnlyManager}
              className={`mt-1.5 ${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {STAFF_ROLES.map((value) => (
                <option key={value} value={value}>
                  {STAFF_ROLE_LABELS[value]}
                </option>
              ))}
            </select>
            <span className="type-meta mt-1.5 block">
              {isOnlyManager
                ? 'This is the only manager. Promote someone else before changing this role.'
                : 'Role controls access to team management.'}
            </span>
          </label>

          <label className="block">
            <span className="type-eyebrow text-notice-muted" id="staff-employment-status-label">
              Employment status
            </span>
            <select
              id="staff-employment-status"
              aria-labelledby="staff-employment-status-label"
              value={status}
              onChange={(event) => setStatus(event.target.value as StaffStatus)}
              className={`mt-1.5 ${fieldClass}`}
            >
              {STAFF_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STAFF_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!staff && (
        <div className="mt-5 rounded-xl bg-surface-deep/60 px-4 py-3">
          <p className="type-eyebrow text-notice-muted">Account access</p>
          <p className="mt-1 type-meta text-notice-secondary">
            A temporary password will be generated automatically and shown once after the account is
            created.
          </p>
        </div>
      )}

      {optionsError && (
        <p role="alert" className="mt-5 type-body text-status-danger">
          {optionsError}
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="mt-5 type-body text-status-danger">
          {errorMessage}
        </p>
      )}

      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="cursor-pointer rounded-full border border-control-border px-6 py-2.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-2.5 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : staff ? 'Save changes' : 'Create employee account'}
        </button>
      </div>
    </div>
  );
};

export const StaffEditModal: React.FC<StaffEditModalProps> = ({ isOpen, ...formProps }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen onClose={formProps.saving ? undefined : formProps.onClose}>
      {/* Keyed so switching between "add" and a specific person rebuilds the form. */}
      <StaffEditForm key={formProps.staff?.id ?? 'new'} {...formProps} />
    </Modal>
  );
};

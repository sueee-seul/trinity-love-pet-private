import React, { useEffect, useId, useState } from 'react';
import { StaffRoleBadge, StaffStatusBadge } from './StaffBadges';
import type { StaffMember, StaffSelfEdit } from '../../types/staff';
import { MAX_IMAGE_LABEL, validateImageFile } from '../../../../shared/utils/imageUpload';
import { phoneError } from '../../../../shared/utils/phone';

interface ProfileIdentityCardProps {
  staff: StaffMember;
  saving: boolean;
  saveError: string | null;
  onSave: (changes: Partial<StaffSelfEdit>) => Promise<boolean>;
}

/** The generated initials shown until someone uploads a real picture. */
const placeholderAvatarFor = (name: string): string =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=eb9c14&color=fff&bold=true`;

const avatarFor = (staff: StaffMember): string =>
  staff.avatarUrl ?? placeholderAvatarFor(staff.name);

const fieldClass =
  'w-full rounded-xl border border-field-border bg-surface-cream px-4 py-2.5 type-body ' +
  'focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus';

/**
 * Role and employee number are shown but never editable here. Role belongs to a
 * manager, and letting an account raise its own role would make every
 * permission check in the product meaningless.
 */
const roleHintFor = (staff: StaffMember): string =>
  staff.employee_role === 'manager'
    ? 'Roles are changed from the team list below.'
    : 'Your role is set by a manager.';

interface IdentityEditFormProps {
  staff: StaffMember;
  saving: boolean;
  onSave: (changes: Partial<StaffSelfEdit>) => Promise<boolean>;
  onDone: () => void;
}

/**
 * Mounted only while editing, so it starts from the current record every time
 * and needs no effect to keep itself in sync.
 */
const IdentityEditForm: React.FC<IdentityEditFormProps> = ({ staff, saving, onSave, onDone }) => {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(staff.avatarUrl ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputId = useId();
  const phoneProblem = phoneError(phone, 'A contact number');

  useEffect(() => {
    return (): void => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // The picture is only staged here; it reaches the server with the rest of
  // the form, so Cancel really discards it.
  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;
    const { error } = validateImageFile(file);
    setPhotoError(error);
    if (!error) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removePhoto = (): void => {
    setAvatarFile(null);
    setAvatarUrl(null);
    setPreviewUrl(null);
    setPhotoError(null);
  };

  const handleSave = async (): Promise<void> => {
    if (phoneProblem) {
      return;
    }
    const saved = await onSave({
      name: name.trim(),
      phone: phone.trim(),
      avatarUrl,
      avatarFile,
    });
    if (saved) {
      onDone();
    }
  };

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border-soft bg-surface-cream">
          <img
            src={previewUrl ?? avatarUrl ?? placeholderAvatarFor(name || staff.name)}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={photoInputId}
              className="cursor-pointer inline-flex h-9 items-center justify-center rounded-full border border-control-border px-4 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
            >
              Upload photo
            </label>
            <input
              id={photoInputId}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handlePhoto}
            />
            {(avatarUrl || previewUrl) && (
              <button
                type="button"
                onClick={removePhoto}
                className="cursor-pointer type-meta font-bold text-status-danger"
              >
                Remove
              </button>
            )}
            <span className="type-meta text-notice-muted">{MAX_IMAGE_LABEL}</span>
          </div>
          {photoError && (
            <p role="alert" className="type-meta text-status-danger">
              {photoError}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Full name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Contact number</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+64 21 123 4567"
            aria-invalid={phoneProblem !== null}
            className={`mt-1.5 ${fieldClass}`}
          />
          {phoneProblem && (
            <span role="alert" className="mt-1 block type-meta text-status-danger">
              {phoneProblem}
            </span>
          )}
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || name.trim().length === 0 || phoneProblem !== null}
          className="cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-2.5 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="cursor-pointer rounded-full border border-control-border px-6 py-2.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
        >
          Cancel
        </button>
        <p className="type-meta">{roleHintFor(staff)}</p>
      </div>
    </>
  );
};

/** The roster is free text; an older row may hold an empty JSON list, which is no roster at all. */
const rosterText = (details: string | null | undefined): string => {
  const trimmed = details?.trim() ?? '';
  return trimmed === '' || trimmed === '[]' ? 'No roster recorded' : trimmed;
};

export const ProfileIdentityCard: React.FC<ProfileIdentityCardProps> = ({
  staff,
  saving,
  saveError,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <img
          src={avatarFor(staff)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-20 w-20 shrink-0 rounded-full object-cover shadow-sm"
        />

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <IdentityEditForm
              staff={staff}
              saving={saving}
              onSave={onSave}
              onDone={() => setIsEditing(false)}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="type-card-title">{staff.name}</h2>
                <StaffRoleBadge employee_role={staff.employee_role} />
                <StaffStatusBadge status={staff.status} />
              </div>
              {staff.title && <p className="mt-1 type-body text-notice-muted">{staff.title}</p>}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="type-eyebrow text-notice-muted">Email</dt>
                  <dd className="type-body break-words">{staff.email}</dd>
                </div>
                <div>
                  <dt className="type-eyebrow text-notice-muted">Username</dt>
                  <dd className="type-body break-words">{staff.username}</dd>
                </div>
                <div>
                  <dt className="type-eyebrow text-notice-muted">Contact number</dt>
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
                <div>
                  <dt className="type-eyebrow text-notice-muted">Facility</dt>
                  <dd className="type-body">{staff.facilityName}</dd>
                </div>
                <div>
                  <dt className="type-eyebrow text-notice-muted">Employment</dt>
                  <dd className="type-body">{staff.employmentType}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="type-eyebrow text-notice-muted">Shift</dt>
                  <dd className="type-body">{rosterText(staff.shiftDetails)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="cursor-pointer rounded-full border border-control-border px-6 py-2.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
                >
                  Edit my details
                </button>
                <p className="type-meta">{roleHintFor(staff)}</p>
              </div>
            </>
          )}

          {saveError && (
            <p role="alert" className="mt-4 type-body text-status-danger">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

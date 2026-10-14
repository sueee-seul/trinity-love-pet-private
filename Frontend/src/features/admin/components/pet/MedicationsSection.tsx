import React, { useState } from 'react';
import type { MedicationInput } from '../../api/petApi';
import type { PetMedication } from '../../types/pet';

const formatSchedule = (schedule: string[]): string =>
  schedule.length > 0 ? schedule.join(', ') : 'No schedule set';

interface MedicationFormValues {
  name: string;
  strength: string;
  dose: string;
  unit: string;
  route: string;
  schedule: string;
  withFood: boolean;
  instructions: string;
  prescribedBy: string;
  active: boolean;
}

const EMPTY_MEDICATION_FORM: MedicationFormValues = {
  name: '',
  strength: '',
  dose: '',
  unit: '',
  route: '',
  schedule: '',
  withFood: false,
  instructions: '',
  prescribedBy: '',
  active: true,
};

const medicationToFormValues = (medication: PetMedication): MedicationFormValues => ({
  name: medication.name,
  strength: medication.strength ?? '',
  dose: String(medication.dose),
  unit: medication.unit,
  route: medication.route,
  schedule: medication.schedule.join(', '),
  withFood: medication.withFood,
  instructions: medication.instructions ?? '',
  prescribedBy: medication.prescribedBy ?? '',
  active: medication.active,
});

const parseMedicationForm = (values: MedicationFormValues): MedicationInput | null => {
  const dose = Number(values.dose);
  if (
    !values.name.trim() ||
    !values.unit.trim() ||
    !values.route.trim() ||
    !Number.isFinite(dose) ||
    dose <= 0
  ) {
    return null;
  }

  return {
    name: values.name.trim(),
    strength: values.strength.trim() || null,
    dose,
    unit: values.unit.trim(),
    route: values.route.trim(),
    schedule: values.schedule
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    withFood: values.withFood,
    instructions: values.instructions.trim() || null,
    prescribedBy: values.prescribedBy.trim() || null,
    active: values.active,
  };
};

const fieldInputClassName =
  'mt-1 block w-full rounded border border-field-border bg-surface-card px-1.5 py-1 type-meta font-normal normal-case text-notice-primary outline-none focus:border-control-border';
const fieldLabelClassName = 'type-eyebrow font-bold uppercase text-notice-secondary';

interface MedicationFormProps {
  initial: MedicationFormValues;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (input: MedicationInput) => Promise<void>;
}

const MedicationForm: React.FC<MedicationFormProps> = ({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof MedicationFormValues>(
    key: K,
    value: MedicationFormValues[K],
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (): Promise<void> => {
    const input = parseMedicationForm(values);
    if (!input) {
      setError('Name, dose, unit, and route are required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (submitError) {
      console.error('Failed to save medication', submitError);
      setError('Unable to save medication. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border-soft bg-surface-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className={fieldLabelClassName}>
          Name
          <input
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Strength
          <input
            value={values.strength}
            onChange={(event) => update('strength', event.target.value)}
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Dose
          <input
            type="number"
            min={0}
            step="any"
            value={values.dose}
            onChange={(event) => update('dose', event.target.value)}
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Unit
          <input
            value={values.unit}
            onChange={(event) => update('unit', event.target.value)}
            placeholder="tablet"
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Route
          <input
            value={values.route}
            onChange={(event) => update('route', event.target.value)}
            placeholder="ORAL"
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Schedule (comma-separated)
          <input
            value={values.schedule}
            onChange={(event) => update('schedule', event.target.value)}
            placeholder="08:00, 20:00"
            className={fieldInputClassName}
          />
        </label>
        <label className={fieldLabelClassName}>
          Prescribed by
          <input
            value={values.prescribedBy}
            onChange={(event) => update('prescribedBy', event.target.value)}
            className={fieldInputClassName}
          />
        </label>
        <div className="flex items-end gap-3 pb-1">
          <label className="flex items-center gap-1 type-meta font-semibold text-notice-secondary">
            <input
              type="checkbox"
              checked={values.withFood}
              onChange={(event) => update('withFood', event.target.checked)}
            />
            With food
          </label>
          <label className="flex items-center gap-1 type-meta font-semibold text-notice-secondary">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => update('active', event.target.checked)}
            />
            Active
          </label>
        </div>
      </div>
      <label className={`block ${fieldLabelClassName}`}>
        Instructions
        <textarea
          value={values.instructions}
          onChange={(event) => update('instructions', event.target.value)}
          rows={2}
          className={fieldInputClassName}
        />
      </label>
      {error && (
        <p role="alert" className="type-meta font-semibold text-status-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="type-meta font-semibold text-notice-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded bg-action-dark px-2 py-1 type-meta font-semibold text-on-action-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
};

interface MedicationItemProps {
  medication: PetMedication;
  onEdit: (medicationId: string, input: Partial<MedicationInput>) => Promise<void>;
  onDelete: (medicationId: string) => Promise<void>;
}

const MedicationItem: React.FC<MedicationItemProps> = ({ medication, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(medication.id);
    } catch (error) {
      console.error('Failed to delete medication', error);
      setDeleteError('Unable to delete. Please try again.');
      setIsDeleting(false);
    }
  };

  if (isEditing) {
    return (
      <MedicationForm
        initial={medicationToFormValues(medication)}
        submitLabel="Save"
        onCancel={() => setIsEditing(false)}
        onSubmit={async (input) => {
          await onEdit(medication.id, input);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border-soft px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="type-meta font-bold text-notice-primary">
          {medication.name}
          {medication.strength && (
            <span className="ml-1 font-normal text-notice-secondary">{medication.strength}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
              medication.active
                ? 'bg-status-success-soft text-status-success'
                : 'bg-surface-cream text-notice-secondary'
            }`}
          >
            {medication.active ? 'Active' : 'Inactive'}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="type-meta font-semibold text-notice-secondary hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="type-meta font-semibold text-status-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Removing...' : 'Delete'}
          </button>
        </div>
      </div>
      <p className="mt-1 type-meta text-notice-secondary">
        {medication.dose} {medication.unit} <span className="px-1">•</span> {medication.route}{' '}
        <span className="px-1">•</span> {formatSchedule(medication.schedule)}
        {medication.withFood ? ' · With food' : ''}
      </p>
      {medication.instructions && (
        <p className="mt-1 type-meta text-notice-secondary">{medication.instructions}</p>
      )}
      {medication.prescribedBy && (
        <p className="mt-1 type-meta text-notice-muted">Prescribed by {medication.prescribedBy}</p>
      )}
      {deleteError && (
        <p role="alert" className="mt-1 type-meta font-semibold text-status-danger">
          {deleteError}
        </p>
      )}
    </div>
  );
};

interface MedicationsSectionProps {
  medications: PetMedication[];
  onAdd: (input: MedicationInput) => Promise<void>;
  onEdit: (medicationId: string, input: Partial<MedicationInput>) => Promise<void>;
  onDelete: (medicationId: string) => Promise<void>;
}

export const MedicationsSection: React.FC<MedicationsSectionProps> = ({
  medications,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="type-eyebrow font-bold uppercase text-notice-secondary">Medications</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="rounded bg-surface-cream px-2 py-1 type-meta font-semibold text-notice-secondary hover:bg-surface-deep"
          >
            Add Medication
          </button>
        )}
      </div>
      <div className="space-y-2">
        {medications.map((medication) => (
          <MedicationItem
            key={medication.id}
            medication={medication}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {isAdding && (
          <MedicationForm
            initial={EMPTY_MEDICATION_FORM}
            submitLabel="Add"
            onCancel={() => setIsAdding(false)}
            onSubmit={async (input) => {
              await onAdd(input);
              setIsAdding(false);
            }}
          />
        )}
      </div>
      {medications.length === 0 && !isAdding && (
        <p className="type-meta text-notice-secondary">No medications on file yet.</p>
      )}
    </div>
  );
};

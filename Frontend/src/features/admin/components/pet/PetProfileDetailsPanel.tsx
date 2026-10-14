import React, { useState } from 'react';
import type { UpdatePetProfileInput } from '../../api/petApi';
import { PET_GENDERS, PET_TYPES, type Pet, type PetGender, type PetType } from '../../types/pet';

const formatAge = (age: number): string => `${age} yr${age === 1 ? '' : 's'} old`;

interface PetProfileDetailsPanelProps {
  pet: Pet;
  onSave: (input: UpdatePetProfileInput) => Promise<void>;
}

const inputClassName =
  'mt-1 w-full rounded-lg border border-field-border bg-surface-card px-2 py-1.25 type-meta font-semibold text-notice-primary outline-none transition focus:border-control-border focus:ring-2 focus:ring-border-soft';

export const PetProfileDetailsPanel: React.FC<PetProfileDetailsPanelProps> = ({ pet, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [type, setType] = useState<PetType>(pet.type);
  const [gender, setGender] = useState<PetGender>(pet.gender);
  const [ageInput, setAgeInput] = useState(String(pet.age));
  const [ownerName, setOwnerName] = useState(pet.ownerName);
  const [breed, setBreed] = useState(pet.breed ?? '');
  const [weightInput, setWeightInput] = useState(pet.weight == null ? '' : String(pet.weight));
  const [microchipNumber, setMicrochipNumber] = useState(pet.microchipNumber ?? '');

  const startEditing = (): void => {
    setType(pet.type);
    setGender(pet.gender);
    setAgeInput(String(pet.age));
    setOwnerName(pet.ownerName);
    setBreed(pet.breed ?? '');
    setWeightInput(pet.weight == null ? '' : String(pet.weight));
    setMicrochipNumber(pet.microchipNumber ?? '');
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEditing = (): void => {
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async (): Promise<void> => {
    const age = Number(ageInput);
    const weight = weightInput.trim() === '' ? null : Number(weightInput);

    if (!Number.isFinite(age) || age <= 0) {
      setSaveError('Age must be a positive number.');
      return;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      setSaveError('Weight must be a positive number.');
      return;
    }
    if (!ownerName.trim()) {
      setSaveError('Owner name is required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        type,
        gender,
        age,
        ownerName: ownerName.trim(),
        breed: breed.trim() || null,
        weight,
        microchipNumber: microchipNumber.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save pet profile', error);
      setSaveError('Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-soft bg-surface-card p-2.5 sm:p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary sm:type-eyebrow">
          Pet profile details
        </p>
        {isEditing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="type-meta font-semibold text-notice-secondary transition hover:text-notice-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-action-dark px-2.5 py-1.25 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg bg-surface-cream px-2.5 py-1.25 type-meta font-semibold text-notice-secondary transition hover:bg-surface-deep"
          >
            Edit info
          </button>
        )}
      </div>

      {saveError && (
        <p role="alert" className="mb-2.5 type-meta font-semibold text-status-danger">
          {saveError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Type
          </p>
          {isEditing ? (
            <select
              aria-label="Type"
              value={type}
              onChange={(event) => setType(event.target.value as PetType)}
              className={inputClassName}
            >
              {PET_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">{pet.type}</p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Gender
          </p>
          {isEditing ? (
            <select
              aria-label="Gender"
              value={gender}
              onChange={(event) => setGender(event.target.value as PetGender)}
              className={inputClassName}
            >
              {PET_GENDERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">{pet.gender}</p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Age
          </p>
          {isEditing ? (
            <input
              aria-label="Age"
              type="number"
              min={1}
              value={ageInput}
              onChange={(event) => setAgeInput(event.target.value)}
              className={inputClassName}
            />
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">{formatAge(pet.age)}</p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Breed
          </p>
          {isEditing ? (
            <input
              aria-label="Breed"
              type="text"
              value={breed}
              onChange={(event) => setBreed(event.target.value)}
              className={inputClassName}
            />
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">
              {pet.breed ?? 'Not set'}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Weight (kg)
          </p>
          {isEditing ? (
            <input
              aria-label="Weight (kg)"
              type="number"
              min={0.1}
              step="0.1"
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              className={inputClassName}
            />
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">
              {pet.weight == null ? 'Not set' : `${pet.weight} kg`}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Microchip
          </p>
          {isEditing ? (
            <input
              aria-label="Microchip"
              type="text"
              value={microchipNumber}
              onChange={(event) => setMicrochipNumber(event.target.value)}
              className={inputClassName}
            />
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">
              {pet.microchipNumber ?? 'Not set'}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-soft bg-surface-card p-2 shadow-card sm:col-span-1">
          <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
            Owner
          </p>
          {isEditing ? (
            <input
              aria-label="Owner"
              type="text"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              className={inputClassName}
            />
          ) : (
            <p className="mt-1 type-meta font-semibold text-notice-primary">{pet.ownerName}</p>
          )}
        </div>
      </div>
    </div>
  );
};

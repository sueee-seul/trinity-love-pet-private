import { useState, type FormEvent, type ReactElement } from 'react';
import type { OwnerProfile, OwnerProfileEditInput, Pet, PetFormInput, Species } from '../types';
import type { PetIntakeDraft } from '../petIntakeApi';
import { EmergencyNumberField, PetContactFields } from './ContactFields';
import { PetIntakeAssistant } from './PetIntakeAssistant';
import { Button, Field, ImageUploadField, inputClass, textareaClass } from './ProfileUi';
import { DateField, parseIsoDate, toIsoDate } from '../../../../shared/components/ui/date';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { EMERGENCY_NUMBER_COPY, OWNER_FORM_COPY } from '../copy/ownerFormCopy';
import { PET_FORM_COPY } from '../copy/petFormCopy';
import { optionalPhoneProblem, requiredPhoneProblem } from '../phoneProblem';
import { initialPetForm } from '../petFormInitial';

export function OwnerForm({
  owner,
  onSave,
  onCancel,
}: {
  owner: OwnerProfile;
  onSave: (value: OwnerProfileEditInput) => void;
  onCancel: () => void;
}): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(OWNER_FORM_COPY);
  const emergencyCopy = usePortalCopy(EMERGENCY_NUMBER_COPY);
  const [fullName, setFullName] = useState(owner.fullName);
  const email = owner.email;
  const [phone, setPhone] = useState(owner.phone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(owner.avatarUrl ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [address, setAddress] = useState(owner.address);
  // Held as "YYYY-MM-DD", the format the profile API stores, so it is sent back unchanged.
  const [dateOfBirth, setDateOfBirth] = useState(owner.dateOfBirth ?? '');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(
    owner.emergencyContactNumber,
  );

  const phoneProblem = requiredPhoneProblem(phone, copy.phoneErrors);
  // Optional, like the address: accounts made by the booking form have neither.
  const emergencyProblem = optionalPhoneProblem(emergencyContactNumber, emergencyCopy.formatError);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (phoneProblem || emergencyProblem) {
      return;
    }
    onSave({
      fullName: fullName.trim(),
      phone: phone.trim(),
      avatarUrl,
      avatarFile,
      address: address.trim(),
      dateOfBirth: dateOfBirth || null,
      emergencyContactNumber: emergencyContactNumber.trim(),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ImageUploadField
        label={copy.profilePhoto}
        value={avatarUrl}
        onChange={(file) => {
          setAvatarFile(file);
          if (file === null) {
            setAvatarUrl(null);
          }
        }}
        fallback={<span className="type-meta text-notice-muted">{copy.noPhoto}</span>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={copy.fullName}>
          <input
            required
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label={copy.email}>
          <input
            readOnly
            disabled
            type="email"
            className={`${inputClass} cursor-not-allowed opacity-60`}
            value={email}
            title={copy.emailLocked}
          />
        </Field>
        <Field label={copy.phone}>
          <input
            className={inputClass}
            value={phone}
            placeholder="+64 21 123 4567"
            aria-invalid={phoneProblem !== null}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneProblem && (
            <span role="alert" className="mt-1 block type-meta text-status-danger">
              {phoneProblem}
            </span>
          )}
        </Field>
        <Field label={copy.dateOfBirth} htmlFor="owner-date-of-birth">
          <DateField
            id="owner-date-of-birth"
            locale={locale}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            max={toIsoDate(new Date())}
            yearPicker
            className={inputClass}
          />
        </Field>
        <EmergencyNumberField
          value={emergencyContactNumber}
          error={emergencyProblem}
          onChange={setEmergencyContactNumber}
        />
      </div>
      <Field label={copy.address}>
        <textarea
          className={textareaClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button type="submit" disabled={phoneProblem !== null || emergencyProblem !== null}>
          {copy.save}
        </Button>
      </div>
    </form>
  );
}

export function PetForm({
  pet,
  onSave,
  onCancel,
}: {
  pet?: Pet;
  onSave: (value: PetFormInput) => void;
  onCancel: () => void;
}): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(PET_FORM_COPY);
  const initial = initialPetForm(pet);

  const [name, setName] = useState(initial.name);
  const [species, setSpecies] = useState<Species>(initial.species);
  const [breed, setBreed] = useState(initial.breed ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Held as "YYYY-MM-DD", the format the profile API stores, so it is sent back unchanged.
  const [birthDate, setBirthDate] = useState(initial.birthDate ?? '');
  const [sex, setSex] = useState(initial.sex ?? '');
  const [desexed, setDesexed] = useState(initial.desexed);
  const [weightKg, setWeightKg] = useState(initial.weightKg?.toString() ?? '');
  const [colour, setColour] = useState(initial.colour ?? '');
  const [microchip, setMicrochip] = useState(initial.microchip ?? '');
  const [dietNotes, setDietNotes] = useState(initial.dietNotes ?? '');
  const [allergies, setAllergies] = useState(initial.allergies.join(', '));
  const [behaviourNotes, setBehaviourNotes] = useState(initial.behaviourNotes ?? '');
  const [vetName, setVetName] = useState(initial.vetName ?? '');
  const [vetPhone, setVetPhone] = useState(initial.vetPhone ?? '');
  const [emergencyContact, setEmergencyContact] = useState(initial.emergencyContact ?? '');

  /**
   * Fills the form from a description the owner wrote.
   *
   * Only the keys the server returned are touched: a field it did not recognise keeps whatever the
   * owner had already typed, rather than being blanked by a draft that never mentioned it. Nothing
   * is saved here. The owner reviews the fields and presses Save like any other edit.
   */
  const applyDraft = (draft: PetIntakeDraft): void => {
    if (draft.name !== undefined) setName(draft.name);
    if (draft.species !== undefined) setSpecies(draft.species);
    if (draft.breed !== undefined) setBreed(draft.breed);
    // The date field can only hold a real day, so a draft date that is not one is left out like an
    // unrecognised field instead of being saved as text the field cannot show.
    if (draft.birthDate !== undefined && parseIsoDate(draft.birthDate)) {
      setBirthDate(draft.birthDate);
    }
    if (draft.sex !== undefined) setSex(draft.sex);
    if (draft.desexed !== undefined) setDesexed(draft.desexed);
    if (draft.weightKg !== undefined) setWeightKg(String(draft.weightKg));
    if (draft.colour !== undefined) setColour(draft.colour);
    if (draft.microchip !== undefined) setMicrochip(draft.microchip);
    if (draft.dietNotes !== undefined) setDietNotes(draft.dietNotes);
    if (draft.allergies !== undefined) setAllergies(draft.allergies.join(', '));
    if (draft.behaviourNotes !== undefined) setBehaviourNotes(draft.behaviourNotes);
    if (draft.vetName !== undefined) setVetName(draft.vetName);
    if (draft.vetPhone !== undefined) setVetPhone(draft.vetPhone);
    if (draft.emergencyContact !== undefined) setEmergencyContact(draft.emergencyContact);

    /*
     * Medications are read but not applied. They live in their own records with their own editor,
     * and a dose written into the wrong pet's chart is the one mistake here that could matter. The
     * assistant lists what it found so the owner can enter them deliberately.
     */
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSave({
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      photoUrl,
      photoFile,
      birthDate: birthDate || null,
      sex: sex === 'male' || sex === 'female' ? sex : '',
      desexed,
      weightKg: weightKg ? Number(weightKg) : null,
      colour: colour.trim() || null,
      microchip: microchip.trim() || null,
      dietNotes: dietNotes.trim() || null,
      allergies: allergies
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      behaviourNotes: behaviourNotes.trim() || null,
      vetName: vetName.trim() || null,
      vetPhone: vetPhone.trim() || null,
      emergencyContact: emergencyContact.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PetIntakeAssistant onDraft={applyDraft} />

      <ImageUploadField
        label={copy.petPhoto}
        value={photoUrl}
        onChange={(file) => {
          setPhotoFile(file);
          if (file === null) {
            setPhotoUrl(null);
          }
        }}
        fallback={<span className="type-meta text-notice-muted">{copy.noPhoto}</span>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={copy.petName}>
          <input
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={copy.species}>
          <select
            className={inputClass}
            value={species}
            onChange={(e) => setSpecies(e.target.value as Species)}
          >
            {copy.speciesOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.breed}>
          <input className={inputClass} value={breed} onChange={(e) => setBreed(e.target.value)} />
        </Field>
        <Field label={copy.birthDate} htmlFor="pet-birth-date">
          <DateField
            id="pet-birth-date"
            locale={locale}
            value={birthDate}
            onChange={setBirthDate}
            max={toIsoDate(new Date())}
            yearPicker
            className={inputClass}
          />
        </Field>
        <Field label={copy.sex}>
          <select
            className={inputClass}
            value={sex ?? ''}
            onChange={(e) => setSex(e.target.value as 'male' | 'female' | '')}
          >
            {copy.sexOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.weight}>
          <input
            type="number"
            min="0"
            step="0.1"
            className={inputClass}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </Field>
        <Field label={copy.colour}>
          <input
            className={inputClass}
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
        </Field>
        <Field label={copy.microchip}>
          <input
            className={inputClass}
            value={microchip}
            onChange={(e) => setMicrochip(e.target.value)}
          />
        </Field>
        <Field label={copy.allergies}>
          <input
            className={inputClass}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
          />
        </Field>
        <PetContactFields
          vetName={vetName}
          vetPhone={vetPhone}
          emergencyContact={emergencyContact}
          onVetName={setVetName}
          onVetPhone={setVetPhone}
          onEmergencyContact={setEmergencyContact}
        />
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={desexed} onChange={(e) => setDesexed(e.target.checked)} />
          <span className="type-body">{copy.desexed}</span>
        </label>
      </div>
      <Field label={copy.dietNotes}>
        <textarea
          className={textareaClass}
          value={dietNotes}
          onChange={(e) => setDietNotes(e.target.value)}
        />
      </Field>
      <Field label={copy.behaviourNotes}>
        <textarea
          className={textareaClass}
          value={behaviourNotes}
          onChange={(e) => setBehaviourNotes(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button type="submit">{pet ? copy.savePet : copy.addPet}</Button>
      </div>
    </form>
  );
}

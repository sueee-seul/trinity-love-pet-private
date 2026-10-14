import React, { useState } from 'react';
import { useFacilities } from '../../hooks/useFacilities';
import { FACILITY_SIZES, type Facility, type FacilityEdit } from '../../api/facilityApi';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-field-border bg-surface-cream px-4 py-2 type-body focus:border-control-border focus:outline-none';

const toEdit = (facility: Facility): FacilityEdit => ({
  name: facility.name,
  suburb: facility.suburb,
  city: facility.city,
  size: facility.size,
  capacity: facility.capacity,
  address: facility.address,
  phone: facility.phone,
  email: facility.email,
  about: facility.about,
});

/**
 * Manager-editable facility details.
 *
 * Everything here is a controlled input backed by `PATCH /api/admin/facilities/:id`.
 * The previous version of this card used `defaultValue` with no handler, so it
 * looked editable and silently discarded every keystroke on refresh.
 */
export const FacilitySettingsPanel: React.FC = () => {
  const { facilities, loading, error, saveError, savingId, save, clearSaveError } = useFacilities();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<{ id: string; values: FacilityEdit } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Derived during render rather than synced in an effect: the list arrives
  // asynchronously, and defaulting to the first row here means the panel is
  // never a dropdown with nothing under it.
  const active = facilities.find((item) => item.id === selectedId) ?? facilities[0] ?? null;
  const draft = active ? (edits?.id === active.id ? edits.values : toEdit(active)) : null;

  const selectFacility = (id: string): void => {
    clearSaveError();
    setSavedId(null);
    setEdits(null);
    setSelectedId(id);
  };

  const change = <K extends keyof FacilityEdit>(key: K, value: FacilityEdit[K]): void => {
    if (!active || !draft) {
      return;
    }
    setSavedId(null);
    setEdits({ id: active.id, values: { ...draft, [key]: value } });
  };

  const handleSave = async (): Promise<void> => {
    if (!active || !draft) {
      return;
    }
    const ok = await save(active.id, draft);
    if (ok) {
      setEdits(null);
      setSavedId(active.id);
    } else {
      setSavedId(null);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-2">Facility details</h3>
        <p className="type-body text-notice-muted mb-0">Loading facilities…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-2">Facility details</h3>
        <p role="alert" className="type-body text-status-danger mb-0">
          {error}
        </p>
      </section>
    );
  }

  if (!draft || !active) {
    return (
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-2">Facility details</h3>
        <p className="type-body text-notice-muted mb-0">
          No facilities are set up yet, so there is nothing to edit here.
        </p>
      </section>
    );
  }

  const saving = savingId === active.id;

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="type-title">Facility details</h3>
          <p className="type-meta mt-1 mb-0">
            Managers can edit these. Changes are saved to the server.
          </p>
        </div>
        {facilities.length > 1 && (
          <label className="block">
            <span className="type-eyebrow text-notice-muted">Editing</span>
            <select
              value={active.id}
              onChange={(event) => selectFacility(event.target.value)}
              className={inputClass}
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Facility name</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => change('name', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Street address</span>
          <input
            type="text"
            value={draft.address}
            onChange={(event) => change('address', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Suburb</span>
          <input
            type="text"
            value={draft.suburb ?? ''}
            onChange={(event) => change('suburb', event.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">City</span>
          <input
            type="text"
            value={draft.city ?? ''}
            onChange={(event) => change('city', event.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Contact phone</span>
          <input
            type="tel"
            value={draft.phone ?? ''}
            onChange={(event) => change('phone', event.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Public contact email</span>
          <input
            type="email"
            value={draft.email ?? ''}
            onChange={(event) => change('email', event.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Facility size</span>
          <select
            value={draft.size}
            onChange={(event) => change('size', event.target.value as FacilityEdit['size'])}
            className={inputClass}
          >
            {FACILITY_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="type-eyebrow text-notice-muted">Daily pet capacity</span>
          <input
            type="number"
            min={0}
            value={draft.capacity}
            onChange={(event) => change('capacity', Number(event.target.value))}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="type-eyebrow text-notice-muted">About this facility</span>
        <textarea
          rows={3}
          value={draft.about ?? ''}
          onChange={(event) => change('about', event.target.value || null)}
          className={`${inputClass} resize-y`}
        />
      </label>

      {saveError && (
        <p role="alert" className="type-meta mt-3 text-status-danger">
          {saveError}
        </p>
      )}
      {savedId === active.id && !saveError && (
        <p role="status" className="type-meta mt-3 text-notice-muted">
          Saved.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="cursor-pointer rounded-full bg-action-dark theme-gradient-action px-8 py-2.5 type-button text-on-action-dark shadow-sm transition-colors hover:bg-action-dark-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save facility'}
        </button>
      </div>
    </section>
  );
};

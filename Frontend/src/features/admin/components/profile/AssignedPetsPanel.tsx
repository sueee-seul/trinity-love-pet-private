import React from 'react';
import type { AssignedPet } from '../../types/staff';

interface AssignedPetsPanelProps {
  assignments: AssignedPet[];
  loading?: boolean;
  /** Omitted on the manager's own card, where the heading already has context. */
  personName?: string;
}

/**
 * Deliberately titled "assigned pets" rather than "tasks". The shift roster in
 * `staff_assignments` carries start and end times but keys on a different id
 * system, so what is shown here is the pet-to-carer link the UI already holds.
 */
export const AssignedPetsPanel: React.FC<AssignedPetsPanelProps> = ({
  assignments,
  loading = false,
  personName,
}) => {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="type-card-title">
          {personName ? `${personName}'s pets` : 'My assigned pets'}
        </h3>
        {!loading && (
          <span className="type-meta">
            {assignments.length} {assignments.length === 1 ? 'pet' : 'pets'}
          </span>
        )}
      </div>

      {loading && <p className="type-body text-notice-muted">Loading assignments…</p>}

      {!loading && assignments.length === 0 && (
        <p className="type-body text-notice-muted">
          No pets are assigned right now. New assignments appear here as soon as a manager makes
          them.
        </p>
      )}

      {!loading && assignments.length > 0 && (
        <ul className="divide-y divide-border-soft">
          {assignments.map((pet) => (
            <li key={pet.petId} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
              <div className="min-w-40 flex-1">
                <p className="type-body font-medium">{pet.petName}</p>
                <p className="type-meta">
                  {pet.petType} · Owner {pet.ownerName}
                </p>
              </div>
              <div className="text-right">
                <p className="type-meta">Check in</p>
                <p className="type-body">{pet.checkInDate}</p>
              </div>
              <div className="text-right">
                <p className="type-meta">Check out</p>
                <p className="type-body">{pet.checkOutDate ?? 'Still staying'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

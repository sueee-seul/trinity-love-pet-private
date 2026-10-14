import React, { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePetDetail } from '../hooks/usePetDetail';
import { PetProfileDetailsPanel } from '../components/pet/PetProfileDetailsPanel';
import { EditableNotes } from '../components/pet/EditableNotes';
import { MedicationsSection } from '../components/pet/MedicationsSection';
import { TaskTimeline } from '../components/TaskTimeline';
import type { UpdatePetProfileInput } from '../api/petApi';
import { PET_STATUS_LABELS, type Pet } from '../types/pet';
import { AdminPage } from '../components/layout/AdminPage';

const QUICK_LOG_ACTIONS = [
  'Log Update',
  'Send Message',
  'Add Medication',
  'Flag Health',
  'Upload Media',
];

interface PanelProps {
  title: string;
  action?: string;
  children: ReactNode;
}

const Panel: React.FC<PanelProps> = ({ title, action, children }) => (
  <section className="rounded-xl border border-border-soft bg-surface-card p-2.5 shadow-card sm:p-3">
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="type-eyebrow font-bold uppercase tracking-[0.1em] text-notice-primary">
        {title}
      </h2>
      {action && (
        <button
          type="button"
          className="rounded-lg bg-surface-cream px-2 py-0.5 type-meta font-semibold text-notice-secondary hover:bg-surface-deep"
        >
          {action}
        </button>
      )}
    </div>
    {children}
  </section>
);

const formatAge = (age: number): string => `${age} yr${age === 1 ? '' : 's'} old`;

interface DashboardHeaderProps {
  pet: Pet;
  showDetails: boolean;
  onToggleDetails: () => void;
  onSaveProfile: (input: UpdatePetProfileInput) => Promise<void>;
}

/**
 * The pet's status is its current or next stay's, named as the owner reads it. Arrivals are
 * recorded on that stay at the Bookings desk, and a stay ends at its pick-up time, so this page
 * offers the desk instead of a check-in switch of its own (which used to stick across stays).
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  pet,
  showDetails,
  onToggleDetails,
  onSaveProfile,
}) => (
  <header className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-card px-3 py-3 shadow-card sm:px-4">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-cream type-body font-bold text-notice-secondary">
        {pet.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <h1 className="type-display leading-tight text-notice-primary">
          {pet.name}{' '}
          <span className="ml-1 type-meta font-normal text-notice-secondary sm:type-meta">
            Owner: <b>{pet.ownerName}</b>
          </span>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="type-meta text-notice-secondary sm:type-meta">
            {pet.type} <span className="px-1">•</span> {formatAge(pet.age)}{' '}
            <span className="px-1">•</span> {pet.gender}
          </p>
          <span className="inline-flex rounded-full bg-surface-cream px-2 py-0.5 type-eyebrow font-bold uppercase tracking-[0.08em] text-notice-secondary sm:type-eyebrow">
            {PET_STATUS_LABELS[pet.status]}
          </span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden text-right type-meta font-semibold text-notice-secondary sm:block">
        <p className="type-meta">Check-in: {pet.checkInDate}</p>
        <p className="font-normal">Check-out: {pet.checkOutDate ?? 'Not yet scheduled'}</p>
      </div>
      {pet.status === 'approved' && (
        <Link
          to="/admin/bookings"
          className="rounded-lg bg-status-success px-2.5 py-1.5 type-meta font-semibold text-white transition hover:bg-status-success"
        >
          Record arrival at the desk
        </Link>
      )}
      <button
        type="button"
        onClick={onToggleDetails}
        aria-label={showDetails ? 'Collapse pet profile details' : 'Expand pet profile details'}
        aria-expanded={showDetails}
        aria-controls="pet-profile-details"
        className="rounded-lg bg-surface-cream px-2.5 py-1.5 type-meta font-semibold text-notice-secondary transition hover:bg-surface-deep"
      >
        <span aria-hidden="true">{showDetails ? '⌃' : '⌄'}</span>
      </button>
    </div>
    {showDetails && (
      <div id="pet-profile-details" className="order-3 w-full border-t border-border-soft pt-2.5">
        <PetProfileDetailsPanel pet={pet} onSave={onSaveProfile} />
      </div>
    )}
  </header>
);

export const PetDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    pet,
    loading,
    error,
    savePetProfile,
    saveHealthNotes,
    saveBehaviourNotes,
    addMedication,
    editMedication,
    removeMedication,
  } = usePetDetail(id ?? '');
  const [showDetails, setShowDetails] = useState(false);
  const [quickLogs, setQuickLogs] = useState<string[]>([]);
  const [taskStaff, setTaskStaff] = useState<string[]>([]);

  const addQuickLog = (label: string): void => setQuickLogs((current) => [label, ...current]);

  if (loading) {
    return <div className="type-body py-20 text-center text-notice-muted">Loading...</div>;
  }

  if (error || !pet) {
    return (
      <div className="py-20 text-center">
        <p role="alert" className="type-body text-status-danger">
          {error ?? 'Pet not found.'}
        </p>
        <Link
          to="/admin/pets"
          className="mt-4 inline-block type-button text-accent-foreground underline"
        >
          Back to Pet List
        </Link>
      </div>
    );
  }

  // Reflects the staff assigned across this pet's Task Timeline.
  const assigneeName = taskStaff.join(', ') || 'Unassigned';

  return (
    <AdminPage width="standard">
      <Link
        to="/admin/pets"
        className="inline-flex items-center gap-1 type-meta font-semibold text-notice-secondary hover:underline"
      >
        ← Back to Pet List
      </Link>

      <DashboardHeader
        pet={pet}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails((open) => !open)}
        onSaveProfile={savePetProfile}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-surface-card px-3 py-2 shadow-card">
        <span className="mr-1 type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
          Quick logs:
        </span>
        {QUICK_LOG_ACTIONS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => addQuickLog(label)}
            className="rounded-lg bg-surface-cream px-2.5 py-1 type-meta font-semibold text-notice-secondary transition hover:bg-surface-deep"
          >
            {label}
          </button>
        ))}
        {quickLogs.length > 0 && (
          <span className="ml-auto type-meta text-notice-secondary">Added: {quickLogs[0]}</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.04fr_1fr]">
        <div className="space-y-4">
          <Panel title="Today's Care Summary">
            <div className="divide-y divide-border-soft overflow-hidden rounded-xl border border-border-soft bg-surface-card">
              {[
                ['Check-in', pet.checkInDate],
                ['Check-out', pet.checkOutDate ?? 'Not yet scheduled'],
                ['Assigned staff', assigneeName],
                ['Next event', 'Not scheduled'],
                ['Meals', 'Not recorded'],
                ['Medication', 'None on file'],
                ['Alerts', 'None'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
                      {label}
                    </p>
                    <p className="mt-1 type-meta font-semibold leading-5 text-notice-primary">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <TaskTimeline petId={pet.id} onAssignedStaffChange={setTaskStaff} />
        </div>
        <div className="space-y-4">
          <Panel title="Health & Medication Panel">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 type-eyebrow font-bold uppercase tracking-[0.12em] text-notice-secondary">
                  Health Notes
                </h3>
                <EditableNotes
                  value={pet.healthNotes}
                  placeholder="No health notes recorded yet."
                  onSave={saveHealthNotes}
                />
              </div>
              <div className="border-t border-border-soft pt-3">
                <MedicationsSection
                  medications={pet.medications}
                  onAdd={addMedication}
                  onEdit={editMedication}
                  onDelete={removeMedication}
                />
              </div>
            </div>
          </Panel>
          <Panel title="Behaviour & Personality">
            <div className="rounded-xl border border-border-soft bg-surface-card p-3">
              <EditableNotes
                value={pet.behaviourNotes}
                placeholder="No behaviour notes recorded yet."
                onSave={saveBehaviourNotes}
              />
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
};

import React, { useEffect, useState } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal';
import { fetchStaffAssignments } from '../../api/staffApi';
import { AssignedPetsPanel } from './AssignedPetsPanel';
import type { AssignedPet, StaffMember } from '../../types/staff';

interface StaffAssignmentsModalProps {
  isOpen: boolean;
  staff: StaffMember | null;
  onClose: () => void;
}

export const StaffAssignmentsModal: React.FC<StaffAssignmentsModalProps> = ({
  isOpen,
  staff,
  onClose,
}) => {
  const [assignments, setAssignments] = useState<AssignedPet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !staff) {
      return;
    }

    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStaffAssignments(staff.id);
        if (!cancelled) {
          setAssignments(data);
        }
      } catch (caught) {
        console.error('Failed to load assignments', caught);
        if (!cancelled) {
          setAssignments([]);
          setError('Unable to load assignments. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return (): void => {
      cancelled = true;
    };
  }, [isOpen, staff]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-8">
        {error ? (
          <p role="alert" className="type-body text-status-danger">
            {error}
          </p>
        ) : (
          <AssignedPetsPanel assignments={assignments} loading={loading} personName={staff?.name} />
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-control-border px-6 py-2.5 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

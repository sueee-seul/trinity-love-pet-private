import { useCallback, useEffect, useState } from 'react';
import {
  createStaffMember,
  deleteStaffMember,
  fetchStaffList,
  fetchStaffManagementOptions,
  updateStaffMember,
} from '../api/staffApi';
import type {
  StaffCreateInput,
  StaffCreateResult,
  StaffManagementOptions,
  StaffManagedEdit,
  StaffMember,
} from '../types/staff';

interface StaffDirectoryState {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  /** Message from a rejected write, e.g. removing the only manager. */
  actionError: string | null;
  clearActionError: () => void;
  pendingId: string | null;
  options: StaffManagementOptions;
  optionsLoading: boolean;
  optionsError: string | null;
  addStaff: (input: StaffCreateInput) => Promise<StaffCreateResult | null>;
  editStaff: (id: string, changes: Partial<StaffManagedEdit>) => Promise<StaffMember | null>;
  removeStaff: (id: string) => Promise<boolean>;
}

export const useStaffDirectory = (): StaffDirectoryState => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [options, setOptions] = useState<StaffManagementOptions>({
    facilities: [],
    employmentTypes: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const data = await fetchStaffList();
        if (!cancelled) {
          setStaff(data);
          setError(null);
        }
      } catch (caught) {
        console.error('Failed to load the staff directory', caught);
        if (!cancelled) {
          setStaff([]);
          setError('Unable to load the team. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const loadOptions = async (): Promise<void> => {
      try {
        const data = await fetchStaffManagementOptions();
        if (!cancelled) {
          setOptions(data);
          setOptionsError(null);
        }
      } catch (caught) {
        console.error('Failed to load staff management options', caught);
        if (!cancelled) {
          setOptions({ facilities: [], employmentTypes: [] });
          setOptionsError('Unable to load employee account options. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    };

    load();
    loadOptions();

    return (): void => {
      cancelled = true;
    };
  }, []);

  const addStaff = useCallback(
    async (input: StaffCreateInput): Promise<StaffCreateResult | null> => {
      setActionError(null);
      setPendingId('new');
      try {
        const created = await createStaffMember(input);
        setStaff((current) =>
          [...current, created.staff].sort((a, b) => a.name.localeCompare(b.name)),
        );
        return created;
      } catch (caught) {
        console.error('Failed to add a staff member', caught);
        setActionError(
          caught instanceof Error ? caught.message : 'Could not add the staff member.',
        );
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  const editStaff = useCallback(
    async (id: string, changes: Partial<StaffManagedEdit>): Promise<StaffMember | null> => {
      setActionError(null);
      setPendingId(id);
      try {
        const updated = await updateStaffMember(id, changes);
        setStaff((current) =>
          current
            .map((member) => (member.id === id ? updated : member))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        return updated;
      } catch (caught) {
        console.error('Failed to update a staff member', caught);
        setActionError(caught instanceof Error ? caught.message : 'Could not save the changes.');
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  const removeStaff = useCallback(async (id: string): Promise<boolean> => {
    setActionError(null);
    setPendingId(id);
    try {
      await deleteStaffMember(id);
      setStaff((current) => current.filter((member) => member.id !== id));
      return true;
    } catch (caught) {
      console.error('Failed to remove a staff member', caught);
      setActionError(
        caught instanceof Error ? caught.message : 'Could not remove the staff member.',
      );
      return false;
    } finally {
      setPendingId(null);
    }
  }, []);

  return {
    staff,
    loading,
    error,
    actionError,
    clearActionError: (): void => setActionError(null),
    pendingId,
    options,
    optionsLoading,
    optionsError,
    addStaff,
    editStaff,
    removeStaff,
  };
};

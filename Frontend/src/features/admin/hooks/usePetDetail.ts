import { useEffect, useState } from 'react';
import {
  fetchPetDetail,
  fetchPetAssignments,
  createPetAssignment,
  deletePetAssignment,
  updatePetProfile,
  updatePetHealthNotes,
  updatePetBehaviourNotes,
  createPetMedication,
  updatePetMedication,
  deletePetMedication,
  type UpdatePetProfileInput,
  type CreatePetAssignmentInput,
  type MedicationInput,
} from '../api/petApi';
import { fetchStaffOptions } from '../api/feedbackApi';
import type { PetAssignment, PetDetail } from '../types/pet';
import type { StaffOption } from '../types/feedback';

interface UsePetDetailState {
  pet: PetDetail | null;
  assignments: PetAssignment[];
  assignmentsLoading: boolean;
  assignmentsError: string | null;
  staffOptions: StaffOption[];
  loading: boolean;
  error: string | null;
  savePetProfile: (input: UpdatePetProfileInput) => Promise<void>;
  createAssignment: (input: CreatePetAssignmentInput) => Promise<void>;
  deleteAssignment: (assignmentUuid: string) => Promise<void>;
  saveHealthNotes: (notes: string | null) => Promise<void>;
  saveBehaviourNotes: (notes: string | null) => Promise<void>;
  addMedication: (input: MedicationInput) => Promise<void>;
  editMedication: (medicationId: string, input: Partial<MedicationInput>) => Promise<void>;
  removeMedication: (medicationId: string) => Promise<void>;
}

export const usePetDetail = (id: string): UsePetDetailState => {
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [assignments, setAssignments] = useState<PetAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPet = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPetDetail(id);
        if (!cancelled) {
          setPet(data);
        }
      } catch (fetchError) {
        console.error('Failed to fetch pet', fetchError);
        if (!cancelled) {
          setPet(null);
          setError('Unable to load this pet. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPet();

    return (): void => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadAssignments = async (): Promise<void> => {
      setAssignmentsLoading(true);
      setAssignmentsError(null);
      try {
        const data = await fetchPetAssignments(id);
        if (!cancelled) {
          setAssignments(data);
        }
      } catch (fetchError) {
        console.error('Failed to fetch pet assignments', fetchError);
        if (!cancelled) {
          setAssignments([]);
          setAssignmentsError('Unable to load assignments. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setAssignmentsLoading(false);
        }
      }
    };

    loadAssignments();

    return (): void => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadStaffOptions = async (): Promise<void> => {
      try {
        const data = await fetchStaffOptions();
        if (!cancelled) {
          setStaffOptions(data);
        }
      } catch (fetchError) {
        console.error('Failed to fetch staff options', fetchError);
      }
    };

    loadStaffOptions();

    return (): void => {
      cancelled = true;
    };
  }, []);

  const savePetProfile = async (input: UpdatePetProfileInput): Promise<void> => {
    const updated = await updatePetProfile(id, input);
    setPet(updated);
  };

  const createAssignment = async (input: CreatePetAssignmentInput): Promise<void> => {
    setAssignmentsError(null);
    const created = await createPetAssignment(id, input);
    setAssignments((current) => [...current, created]);
    try {
      setAssignments(await fetchPetAssignments(id));
    } catch (refreshError) {
      console.error('Failed to refresh pet assignments after creation', refreshError);
      setAssignmentsError('Assignment saved, but the list could not be refreshed.');
    }
  };

  const deleteAssignment = async (assignmentUuid: string): Promise<void> => {
    setAssignmentsError(null);
    await deletePetAssignment(id, assignmentUuid);
    setAssignments((current) => current.filter((assignment) => assignment.uuid !== assignmentUuid));
    try {
      setAssignments(await fetchPetAssignments(id));
    } catch (refreshError) {
      console.error('Failed to refresh pet assignments after deletion', refreshError);
      setAssignmentsError('Assignment deleted, but the list could not be refreshed.');
    }
  };

  const saveHealthNotes = async (notes: string | null): Promise<void> => {
    const updated = await updatePetHealthNotes(id, notes);
    setPet(updated);
  };

  const saveBehaviourNotes = async (notes: string | null): Promise<void> => {
    const updated = await updatePetBehaviourNotes(id, notes);
    setPet(updated);
  };

  const addMedication = async (input: MedicationInput): Promise<void> => {
    const updated = await createPetMedication(id, input);
    setPet(updated);
  };

  const editMedication = async (
    medicationId: string,
    input: Partial<MedicationInput>,
  ): Promise<void> => {
    const updated = await updatePetMedication(id, medicationId, input);
    setPet(updated);
  };

  const removeMedication = async (medicationId: string): Promise<void> => {
    const updated = await deletePetMedication(id, medicationId);
    setPet(updated);
  };

  return {
    pet,
    assignments,
    assignmentsLoading,
    assignmentsError,
    staffOptions,
    loading,
    error,
    savePetProfile,
    createAssignment,
    deleteAssignment,
    saveHealthNotes,
    saveBehaviourNotes,
    addMedication,
    editMedication,
    removeMedication,
  };
};

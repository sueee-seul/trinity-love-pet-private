import { useCallback, useEffect, useState } from 'react';
import {
  fetchFacilities,
  saveFacility,
  type Facility,
  type FacilityEdit,
} from '../api/facilityApi';

interface FacilitiesState {
  facilities: Facility[];
  loading: boolean;
  error: string | null;
  /** Message from a rejected save, e.g. a fractional capacity. */
  saveError: string | null;
  savingId: string | null;
  save: (id: string, changes: FacilityEdit) => Promise<boolean>;
  clearSaveError: () => void;
}

export const useFacilities = (): FacilitiesState => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const data = await fetchFacilities();
        if (!cancelled) {
          setFacilities(data);
          setError(null);
        }
      } catch (caught) {
        console.error('Failed to load facilities', caught);
        if (!cancelled) {
          setFacilities([]);
          setError(
            caught instanceof TypeError
              ? 'Cannot reach the server. Start the backend with npm run dev in the Backend folder.'
              : 'Unable to load the facilities. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return (): void => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (id: string, changes: FacilityEdit): Promise<boolean> => {
    setSaveError(null);
    setSavingId(id);
    try {
      const updated = await saveFacility(id, changes);
      setFacilities((current) =>
        current.map((facility) => (facility.id === id ? updated : facility)),
      );
      return true;
    } catch (caught) {
      console.error('Failed to save a facility', caught);
      setSaveError(caught instanceof Error ? caught.message : 'Could not save the facility.');
      return false;
    } finally {
      setSavingId(null);
    }
  }, []);

  return {
    facilities,
    loading,
    error,
    saveError,
    savingId,
    save,
    clearSaveError: (): void => setSaveError(null),
  };
};

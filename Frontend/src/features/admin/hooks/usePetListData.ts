import { useEffect, useState } from 'react';
import { fetchPetList } from '../api/petApi';
import type { Pet } from '../types/pet';

interface PetListDataState {
  pets: Pet[];
  loading: boolean;
  petsError: string | null;
}

export const usePetListData = (): PetListDataState => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsError, setPetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPets = async (): Promise<void> => {
      setLoading(true);
      setPetsError(null);
      try {
        const data = await fetchPetList();
        if (!cancelled) {
          setPets(data);
        }
      } catch (error) {
        console.error('Failed to fetch pets', error);
        if (!cancelled) {
          setPets([]);
          setPetsError('Unable to load pets. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPets();

    return (): void => {
      cancelled = true;
    };
  }, []);

  return { pets, loading, petsError };
};

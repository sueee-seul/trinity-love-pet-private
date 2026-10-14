import { useMemo } from 'react';
import type { Pet } from '../types/pet';

interface UsePetSearchOptions {
  pets: Pet[];
  query: string;
}

const getSearchableFields = (pet: Pet): string[] => [
  pet.name,
  pet.type,
  String(pet.age),
  pet.gender,
  pet.ownerName,
  pet.checkInDate,
  pet.checkOutDate ?? '',
];

export const usePetSearch = ({ pets, query }: UsePetSearchOptions): Pet[] => {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return pets;
    }

    return pets.filter((pet) =>
      getSearchableFields(pet).some((field) => field.toLowerCase().includes(normalizedQuery)),
    );
  }, [pets, query]);
};

import { useMemo, useState } from 'react';
import { PET_STATUS_ORDER, type Pet, type PetSortColumn, type SortDirection } from '../types/pet';

interface UsePetSortOptions {
  pets: Pet[];
}

interface UsePetSortResult {
  sortedPets: Pet[];
  sortColumn: PetSortColumn;
  sortDirection: SortDirection;
  toggleSort: (column: PetSortColumn) => void;
}

const DEFAULT_SORT_COLUMN: PetSortColumn = 'name';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

type SortValue = string | number | null;

// Pet dates are displayed and stored as DD/MM/YYYY, which Date.parse cannot read reliably:
// it misreads "05/08/2026" as 5 August instead of 8 May, or as an invalid date entirely.
const parseDisplayDate = (value: string): number => {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
};

const getSortValue = (pet: Pet, column: PetSortColumn): SortValue => {
  switch (column) {
    case 'name':
      return pet.name;
    case 'status':
      return PET_STATUS_ORDER[pet.status];
    case 'checkInDate':
      return parseDisplayDate(pet.checkInDate);
    case 'checkOutDate':
      return pet.checkOutDate ? parseDisplayDate(pet.checkOutDate) : null;
    case 'type':
      return pet.type;
    case 'age':
      return pet.age;
    case 'gender':
      return pet.gender;
    case 'ownerName':
      return pet.ownerName;
  }
};

// Pets without a value for the active column (e.g. no check-out date yet, unassigned staff)
// always sink to the bottom, regardless of sort direction.
const compareValues = (a: SortValue, b: SortValue, direction: SortDirection): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const result =
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));

  return direction === 'asc' ? result : -result;
};

export const usePetSort = ({ pets }: UsePetSortOptions): UsePetSortResult => {
  const [sortColumn, setSortColumn] = useState<PetSortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  const toggleSort = (column: PetSortColumn): void => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }
    setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
  };

  const sortedPets = useMemo(() => {
    return [...pets].sort((a, b) =>
      compareValues(getSortValue(a, sortColumn), getSortValue(b, sortColumn), sortDirection),
    );
  }, [pets, sortColumn, sortDirection]);

  return { sortedPets, sortColumn, sortDirection, toggleSort };
};

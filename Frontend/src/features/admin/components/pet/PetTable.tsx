import React from 'react';
import { usePetSort } from '../../hooks/usePetSort';
import {
  PET_STATUS_LABELS,
  type Pet,
  type PetSortColumn,
  type SortDirection,
} from '../../types/pet';

interface PetTableProps {
  pets: Pet[];
  loading: boolean;
  errorMessage: string | null;
  emptyMessage?: string;
  onViewPet: (id: string) => void;
}

const DEFAULT_EMPTY_MESSAGE = 'No pets found.';

const COLUMN_COUNT = 8;
const SKELETON_ROW_COUNT = 5;

const COLUMNS: Array<{ key: PetSortColumn; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'checkInDate', label: 'Check-in' },
  { key: 'checkOutDate', label: 'Check-out' },
  { key: 'type', label: 'Type' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'ownerName', label: 'Owner' },
];

const ARIA_SORT: Record<SortDirection, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
};

interface SortableHeaderCellProps {
  column: PetSortColumn;
  label: string;
  activeColumn: PetSortColumn;
  direction: SortDirection;
  disabled: boolean;
  onSort: (column: PetSortColumn) => void;
}

const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({
  column,
  label,
  activeColumn,
  direction,
  disabled,
  onSort,
}) => {
  const isActive = activeColumn === column;

  return (
    <th
      scope="col"
      aria-sort={isActive ? ARIA_SORT[direction] : 'none'}
      className="px-4 py-3 type-meta text-notice-secondary"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed"
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          className={isActive ? 'text-accent-foreground' : 'text-notice-muted opacity-50'}
        >
          {isActive ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
};

interface TableHeadProps {
  sortColumn: PetSortColumn;
  sortDirection: SortDirection;
  disabled: boolean;
  onSort: (column: PetSortColumn) => void;
}

const TableHead: React.FC<TableHeadProps> = ({ sortColumn, sortDirection, disabled, onSort }) => (
  <thead className="border-b border-border-soft bg-surface-cream">
    <tr>
      {COLUMNS.map((column) => (
        <SortableHeaderCell
          key={column.key}
          column={column.key}
          label={column.label}
          activeColumn={sortColumn}
          direction={sortDirection}
          disabled={disabled}
          onSort={onSort}
        />
      ))}
    </tr>
  </thead>
);

const SkeletonRows: React.FC = () => (
  <>
    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <tr key={index} className="border-b border-border-soft last:border-b-0" aria-hidden="true">
        {Array.from({ length: COLUMN_COUNT }, (_, columnIndex) => (
          <td key={columnIndex} className="px-4 py-4 align-top">
            <div className="h-4 w-full max-w-24 animate-pulse rounded bg-surface-cream" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const PetTable: React.FC<PetTableProps> = ({
  pets,
  loading,
  errorMessage,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  onViewPet,
}) => {
  const { sortedPets, sortColumn, sortDirection, toggleSort } = usePetSort({ pets });
  const isInteractive = !loading && !errorMessage && pets.length > 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border-soft bg-surface-card shadow-sm">
      <table className="min-w-[920px] w-full border-collapse text-left">
        <caption className="sr-only">Pet list</caption>
        <TableHead
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          disabled={!isInteractive}
          onSort={toggleSort}
        />
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : errorMessage ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center">
                <span role="alert" className="type-body text-status-danger">
                  {errorMessage}
                </span>
              </td>
            </tr>
          ) : pets.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMN_COUNT}
                className="px-4 py-10 text-center type-body text-notice-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedPets.map((pet) => (
              <tr
                key={pet.id}
                className="border-b border-border-soft bg-surface-card last:border-b-0"
              >
                <td className="px-4 py-4 align-top type-button text-notice-primary">
                  <button
                    type="button"
                    onClick={() => onViewPet(pet.id)}
                    className="rounded text-left transition-colors hover:text-accent-foreground-hover hover:underline focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    {pet.name}
                  </button>
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">
                  <span className="inline-flex rounded-full bg-surface-cream px-2.5 py-1 type-meta font-semibold text-notice-primary">
                    {PET_STATUS_LABELS[pet.status]}
                  </span>
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">
                  {pet.checkInDate}
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">
                  {pet.checkOutDate ?? 'Not set'}
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">{pet.type}</td>
                <td className="px-4 py-4 align-top type-numeral text-notice-secondary">
                  {pet.age}
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">
                  {pet.gender}
                </td>
                <td className="px-4 py-4 align-top type-body text-notice-secondary">
                  {pet.ownerName}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

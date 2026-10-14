import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PetSearchBar } from '../components/pet/PetSearchBar';
import { PetTable } from '../components/pet/PetTable';
import { usePetListData } from '../hooks/usePetListData';
import { usePetSearch } from '../hooks/usePetSearch';
import { AdminPage } from '../components/layout/AdminPage';

export const PetListPage: React.FC = () => {
  const navigate = useNavigate();
  const { pets, loading, petsError } = usePetListData();
  const [searchQuery, setSearchQuery] = useState('');

  const visiblePets = usePetSearch({ pets, query: searchQuery });

  return (
    <AdminPage width="standard">
      <PetSearchBar value={searchQuery} onChange={setSearchQuery} />
      <PetTable
        pets={visiblePets}
        loading={loading}
        errorMessage={petsError}
        emptyMessage={searchQuery.trim() ? 'No pets match your search.' : 'No pets found.'}
        onViewPet={(id) => navigate(`/admin/pets/${id}`)}
      />
    </AdminPage>
  );
};

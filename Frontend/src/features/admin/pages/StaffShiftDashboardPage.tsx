import type { ReactElement } from 'react';
import { StaffShiftTable } from '../components/profile/StaffShiftTable';
import { AdminPage } from '../components/layout/AdminPage';

export function StaffShiftDashboardPage(): ReactElement {
  return (
    <AdminPage width="standard">
      <StaffShiftTable />
    </AdminPage>
  );
}

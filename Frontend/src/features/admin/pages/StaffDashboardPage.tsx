import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';
import { StaffOverviewStatCards } from '../components/staff-dashboard/StaffOverviewStatCards';
import { StaffOverviewList } from '../components/staff-dashboard/StaffOverviewList';
import { StaffDetailPanel } from '../components/staff-dashboard/StaffDetailPanel';
import { useStaffOverview } from '../hooks/useStaffOverview';
import type { DashboardRange } from '../types/staffDashboard';
import { useSearchParams } from 'react-router-dom';
import { AdminPage } from '../components/layout/AdminPage';

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

export const StaffDashboardPage: React.FC = () => {
  const { data, loading, error, range, setRange } = useStaffOverview('today');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStaffId = searchParams.get('staff');

  const selectStaff = (id: string | null): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('staff', id);
        else next.delete('staff');
        return next;
      },
      { replace: id === null }, // 앱 내 "Back to team" 은 히스토리 안 쌓이게
    );
  };

  return (
    <AdminPage width="wide">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-display">Staff management</h1>
          <p className="type-meta mt-1">Monitor each staff member&apos;s tasks and status</p>
        </div>
        {!selectedStaffId && (
          <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        )}
      </header>

      {selectedStaffId ? (
        <StaffDetailPanel
          key={selectedStaffId}
          staffId={selectedStaffId}
          initialRange={range}
          onBack={() => selectStaff(null)}
        />
      ) : (
        <>
          {loading && !data && (
            <p className="type-body text-notice-muted">Loading the staff dashboard…</p>
          )}

          {error && (
            <p role="alert" className="type-body text-status-danger">
              {error}
            </p>
          )}

          {data && (
            <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <StaffOverviewStatCards totals={data.totals} />
              <StaffOverviewList staff={data.staff} onSelect={selectStaff} />
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
};

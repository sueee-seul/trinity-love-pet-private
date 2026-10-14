import { useEffect, useState } from 'react';
import { fetchKpiReport, type KpiReport } from '../api/kpiReportsApi.js';

export type KpiReportLoad =
  | { status: 'loading' }
  | { status: 'loaded'; report: KpiReport }
  | { status: 'not_found' }
  | { status: 'error' };

export const useKpiReport = (reportId: string): KpiReportLoad => {
  const [load, setLoad] = useState<KpiReportLoad>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchKpiReport(reportId)
      .then((report) => {
        if (active) {
          setLoad(report ? { status: 'loaded', report } : { status: 'not_found' });
        }
      })
      .catch(() => {
        if (active) {
          setLoad({ status: 'error' });
        }
      });
    return (): void => {
      active = false;
    };
  }, [reportId]);

  return load;
};

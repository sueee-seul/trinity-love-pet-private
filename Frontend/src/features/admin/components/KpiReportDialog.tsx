import React from 'react';
import { Modal } from '../../../shared/components/ui/Modal';
import { KpiReportView } from '../pages/KpiReportPage';

/** A saved KPI report opened over the notification centre. Data comes from the saved report. */
export const KpiReportDialog: React.FC<{ reportId: string | null; onClose: () => void }> = ({
  reportId,
  onClose,
}) => (
  <Modal isOpen={reportId !== null} onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="KPI report"
      className="max-h-[85vh] overflow-y-auto p-6"
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border-soft px-4 py-2 type-button text-notice-primary hover:bg-surface-cream"
        >
          Close
        </button>
      </div>
      {reportId && <KpiReportView reportId={reportId} />}
    </div>
  </Modal>
);

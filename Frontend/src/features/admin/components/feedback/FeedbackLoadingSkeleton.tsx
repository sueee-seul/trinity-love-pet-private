import React from 'react';
import type { FeedbackViewMode } from '../../types/feedback';

interface FeedbackLoadingSkeletonProps {
  viewMode: FeedbackViewMode;
}

const SKELETON_ROWS = ['one', 'two', 'three', 'four', 'five'];

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <span className={`block animate-pulse rounded bg-surface-cream ${className}`} />
);

const TableSkeleton: React.FC = () => (
  <div className="overflow-hidden rounded-xl border border-border-soft bg-surface-card shadow-sm">
    <div className="flex items-center gap-4 border-b border-border-soft bg-surface-cream px-4 py-3">
      <SkeletonBar className="h-4 w-8" />
      <SkeletonBar className="h-4 flex-1" />
      <SkeletonBar className="h-4 w-24" />
      <SkeletonBar className="h-4 w-20" />
    </div>
    {SKELETON_ROWS.map((row) => (
      <div
        key={row}
        className="flex items-center gap-4 border-b border-border-soft px-4 py-4 last:border-b-0"
      >
        <SkeletonBar className="h-5 w-5" />
        <div className="flex flex-1 items-center gap-3">
          <SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBar className="h-4 w-2/5" />
            <SkeletonBar className="h-3 w-3/5" />
          </div>
        </div>
        <SkeletonBar className="h-4 w-20" />
        <SkeletonBar className="h-4 w-16" />
      </div>
    ))}
  </div>
);

const CardSkeleton: React.FC = () => (
  <div className="space-y-4">
    {SKELETON_ROWS.slice(0, 3).map((row) => (
      <div key={row} className="rounded-xl border border-border-soft bg-surface-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBar className="h-4 w-2/5" />
            <SkeletonBar className="h-3 w-3/5" />
          </div>
          <SkeletonBar className="h-4 w-16" />
        </div>
        <div className="mt-5 space-y-2">
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-4/5" />
        </div>
        <SkeletonBar className="mt-4 h-6 w-20" />
      </div>
    ))}
  </div>
);

export const FeedbackLoadingSkeleton: React.FC<FeedbackLoadingSkeletonProps> = ({ viewMode }) => {
  return (
    <div aria-hidden="true" className="w-full">
      {viewMode === 'table' ? <TableSkeleton /> : <CardSkeleton />}
    </div>
  );
};

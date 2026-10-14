import React from 'react';

export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="bg-surface-card p-8 rounded-3xl shadow-sm border border-border-soft mt-6 min-h-[400px] flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
      <div className="bg-status-success/10 p-4 rounded-full mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-status-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h1 className="type-display tracking-tight">Admin Website Dashboard</h1>
      <p className="type-body text-notice-secondary max-w-lg">
        Manage your clinic operations, patient records, staff tasks, and upcoming bookings here.
      </p>
    </div>
  );
};

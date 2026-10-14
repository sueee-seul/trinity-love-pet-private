import React from 'react';
import { AccessibilitySettingsToggle, AppearanceSettings } from '../../../../shared/accessibility';
import { FacilitySettingsPanel } from './FacilitySettingsPanel';

export const AdminSettingsView: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <h2 className="type-display mt-1 type-card-title">Platform Settings</h2>
        <p className="type-body text-notice-muted mt-2">
          Manage global configurations for the Wagstay platform.
        </p>
      </header>

      {/*
       * 1. Theme & Appearance
       *
       * It replaces a System Default / Light / Dark dropdown that was wired to nothing. Those
       * three were never this product's themes either. The palettes have names, and two of them
       * are the light and dark minimal ones.
       *
       * The launcher toggle sits with them because a manager has the accessibility bar like
       * everyone else, and this is where they turn it off.
       */}
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-4">Appearance</h3>
        <div className="space-y-4">
          <AppearanceSettings />
          <AccessibilitySettingsToggle />
        </div>
      </section>

      {/* 2. Notification Preferences */}
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-4">Notifications</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-theme-earth rounded" defaultChecked />
            <span className="type-body text-notice-secondary">New booking requests via Email</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-theme-earth rounded" defaultChecked />
            <span className="type-body text-notice-secondary">Daily care summary reminders</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-theme-earth rounded" />
            <span className="type-body text-notice-secondary">
              SMS alerts for urgent parent messages
            </span>
          </label>
        </div>
      </section>

      {/* 3. Facility details: the only section wired to the API. */}
      <FacilitySettingsPanel />

      {/* 4. Booking & Operations */}
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-4">Booking & Operations</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="block">
            <span className="type-eyebrow text-notice-muted block mb-1.5">
              Required Vaccinations
            </span>
            <label className="flex items-center space-x-3 mt-2">
              <input
                type="checkbox"
                className="w-4 h-4 accent-theme-earth rounded"
                defaultChecked
              />
              <span className="type-body type-body text-notice-secondary">Rabies</span>
            </label>
            <label className="flex items-center space-x-3 mt-2">
              <input
                type="checkbox"
                className="w-4 h-4 accent-theme-earth rounded"
                defaultChecked
              />
              <span className="type-body type-body text-notice-secondary">Bordetella</span>
            </label>
          </div>
        </div>
      </section>

      {/* 5. Pricing & Automation */}
      <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
        <h3 className="type-title mb-4">Pricing & Automation</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="type-eyebrow text-notice-muted">Default Daycare Rate ($)</span>
            <input
              type="number"
              defaultValue={45}
              className="mt-1.5 w-full max-w-xs rounded-xl border border-field-border bg-surface-cream px-4 py-2 type-body focus:border-control-border focus:outline-none"
            />
          </label>
          <hr className="border-border-soft" />
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-theme-earth rounded" defaultChecked />
            <span className="type-body text-notice-secondary">
              Automatically send feedback requests 24h after check-out
            </span>
          </label>
        </div>
      </section>

      <p className="type-meta text-notice-muted">
        Notification, booking and pricing preferences above are placeholders. They have no endpoint
        yet, so nothing on those three cards is saved. Appearance and facility details are saved:
        the theme and reading colour in this browser, and the facility details on the server.
      </p>
    </div>
  );
};

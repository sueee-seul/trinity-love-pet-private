import React from 'react';
import { ThemeSettingsPicker } from '../../theme';
import { ContrastSettingsSection } from './ContrastSettingsSection';

/**
 * The theme picker and the reading colour modes, as one block.
 *
 * Every role reaches these two controls, each on their own settings surface: the pet parent in
 * Account Settings, staff on their profile's Settings tab, and a manager in Platform Settings.
 * Pairing them here keeps that one composition in one place, so a change to what "appearance"
 * means does not have to be repeated on three pages and in the toolbar's panel.
 *
 * The launcher toggle is deliberately not part of this. It belongs to the accessibility bar
 * rather than to the appearance of the app, and keeping the two apart means a surface that wants
 * one without the other can say so. Every settings page currently renders it alongside.
 */
export const AppearanceSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      <ThemeSettingsPicker />
      <ContrastSettingsSection />
    </div>
  );
};

export const badgeClass = (value: string): string => {
  if (value === 'urgent' || value === 'cancelled')
    return 'bg-status-danger-soft text-status-danger';
  if (value === 'completed') return 'bg-status-success-soft text-notice-secondary';
  if (value === 'high' || value === 'in_progress')
    return 'bg-status-warning-soft text-accent-foreground';
  return 'bg-surface-cream text-notice-secondary';
};

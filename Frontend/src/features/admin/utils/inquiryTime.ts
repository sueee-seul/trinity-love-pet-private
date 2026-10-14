export function formatInquiryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatInquiryDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function inquiryIsoAt(hour: number, minute: number, daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** Local calendar date (YYYY-MM-DD), the same shape a DateField value has. */
export function toInquiryCalendarDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as a local calendar date (YYYY-MM-DD) - the upper bound for the inquiry date pickers. */
export function todayInquiryCalendarDate(): string {
  return toInquiryCalendarDate(new Date().toISOString());
}

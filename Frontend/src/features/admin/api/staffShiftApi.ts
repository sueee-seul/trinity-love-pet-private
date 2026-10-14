import { API_BASE_URL } from '../../../shared/api';

const BASE = `${API_BASE_URL}/admin/staff-shifts`;

export interface ShiftStaffOption {
  id: string;
  name: string;
  staff_status: string;
}

export interface ShiftNote {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  finish_time: string | null;
  issue: string | null;
}

export interface ShiftNoteInput {
  staffId: string;
  date: string;
  startTime: string | null;
  finishTime: string | null;
  issue: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      message = body?.error?.message ?? body?.message ?? message;
    } catch {
      // non-JSON body
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchShiftStaffOptions(): Promise<ShiftStaffOption[]> {
  return request<ShiftStaffOption[]>(`${BASE}/staff-options`);
}

export interface ShiftNoteListFilter {
  staffId?: string;
  from?: string;
  to?: string;
}

export function fetchShiftNotes(filter: ShiftNoteListFilter = {}): Promise<ShiftNote[]> {
  const params = new URLSearchParams();
  if (filter.staffId) params.set('staffid', filter.staffId);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  const query = params.toString();
  return request<ShiftNote[]>(query ? `${BASE}?${query}` : BASE);
}

export function createShiftNote(input: ShiftNoteInput): Promise<{ id: string }> {
  return request<{ id: string }>(BASE, { method: 'POST', body: JSON.stringify(input) });
}

export function updateShiftNote(id: string, input: ShiftNoteInput): Promise<{ ok: true }> {
  return request<{ ok: true }>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteShiftNote(id: string): Promise<void> {
  return request<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

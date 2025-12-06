import {
  Visitor,
  Visit,
  DashboardStats,
  Space,
  Penalty,
  Program,
  ProgramAttendance,
} from '../types';
import type { CreateVisitorInput } from './mockDb';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
  const url = new URL(path, API_BASE || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const apiFetch = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) {
    // no content
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
};

// --- Kiosk-related operations (HTTP) ---

export const findVisitorByPhone = async (phone: string): Promise<Visitor | undefined> => {
  const url = buildUrl('/api/kiosk/visitors/lookup', { phone });
  const data = await apiFetch<{ visitor: Visitor | null }>(url);
  return data.visitor ?? undefined;
};

export const createVisitor = async (input: CreateVisitorInput): Promise<Visitor> => {
  const url = buildUrl('/api/kiosk/visitors');
  return apiFetch<Visitor>(url, {
    method: 'POST',
    body: JSON.stringify({
      phone_number: input.phone,
      name: input.name,
      birth_date: input.birth_date,
      address: input.address,
      is_startup: input.is_startup,
      notes: input.notes,
      terms_accepted_at: input.terms_accepted_at,
    }),
  });
};

export const getLastActiveVisit = async (visitorId: string): Promise<Visit | undefined> => {
  const url = buildUrl(`/api/kiosk/visitors/${visitorId}/active-visit`);
  const data = await apiFetch<{ visit: Visit | null }>(url);
  return data.visit ?? undefined;
};

export const checkIn = async (
  visitor: Visitor,
  purpose: Visit['purpose'],
  spaceId?: string,
  programId?: string,
): Promise<Visit> => {
  const url = buildUrl('/api/kiosk/visits/checkin');
  return apiFetch<Visit>(url, {
    method: 'POST',
    body: JSON.stringify({
      visitor_id: visitor.id,
      purpose,
      space_id: spaceId,
      program_id: programId,
    }),
  });
};

export const checkOut = async (visitId: string): Promise<Visit> => {
  const url = buildUrl(`/api/kiosk/visits/${visitId}/checkout`);
  return apiFetch<Visit>(url, { method: 'POST' });
};

export const getSpacesWithOccupancy = async (): Promise<(Space & { currentOccupancy: number })[]> => {
  const url = buildUrl('/api/kiosk/spaces');
  return apiFetch<(Space & { currentOccupancy: number })[]>(url);
};

export const getPrograms = async (): Promise<Program[]> => {
  const url = buildUrl('/api/kiosk/programs/active');
  return apiFetch<Program[]>(url);
};

export const getActivePenaltyForVisitor = async (
  visitorId: string,
): Promise<Penalty | undefined> => {
  const url = buildUrl(`/api/kiosk/visitors/${visitorId}/active-penalty`);
  const data = await apiFetch<{ penalty: Penalty | null }>(url);
  return data.penalty ?? undefined;
};

// --- Admin / dashboard operations (HTTP) ---

export const getStats = async (): Promise<DashboardStats> => {
  const url = buildUrl('/api/admin/stats/summary');
  return apiFetch<DashboardStats>(url);
};

export const getActiveVisits = async (): Promise<Visit[]> => {
  const url = buildUrl('/api/admin/visits/active');
  return apiFetch<Visit[]>(url);
};

export const getAllVisits = async (): Promise<Visit[]> => {
  const url = buildUrl('/api/admin/visits');
  return apiFetch<Visit[]>(url);
};

export const deleteVisit = async (visitId: string): Promise<void> => {
  const url = buildUrl(`/api/admin/visits/${visitId}`);
  await apiFetch<void>(url, { method: 'DELETE' });
};

export const updateVisit = async (
  visitId: string,
  update: Partial<Visit>,
): Promise<Visit> => {
  const url = buildUrl(`/api/admin/visits/${visitId}`);
  return apiFetch<Visit>(url, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
};

export const getAllVisitors = async (): Promise<Visitor[]> => {
  const url = buildUrl('/api/admin/visitors');
  return apiFetch<Visitor[]>(url);
};

export const getAllPenalties = async (): Promise<Penalty[]> => {
  const url = buildUrl('/api/admin/penalties');
  return apiFetch<Penalty[]>(url);
};

export const addPenalty = async (
  visitorId: string,
  type: 'warning' | 'suspension',
  reason: string,
): Promise<Penalty> => {
  const url = buildUrl(`/api/admin/visitors/${visitorId}/penalties`);
  return apiFetch<Penalty>(url, {
    method: 'POST',
    body: JSON.stringify({ type, reason }),
  });
};

export const updatePenalty = async (
  penaltyId: string,
  update: Partial<Penalty>,
): Promise<Penalty> => {
  const url = buildUrl(`/api/admin/penalties/${penaltyId}`);
  return apiFetch<Penalty>(url, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
};

export const createProgram = async (input: {
  name: string;
  description?: string;
  start_at: string;
  end_at: string;
  capacity?: number;
}): Promise<Program> => {
  const url = buildUrl('/api/admin/programs');
  return apiFetch<Program>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

export const getProgramAttendances = async (
  programId: string,
): Promise<ProgramAttendance[]> => {
  const url = buildUrl(`/api/admin/programs/${programId}/attendances`);
  return apiFetch<ProgramAttendance[]>(url);
};

export const updateSpace = async (spaceId: string, update: Partial<Space>): Promise<Space> => {
  const url = buildUrl(`/api/admin/spaces/${spaceId}`);
  return apiFetch<Space>(url, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
};

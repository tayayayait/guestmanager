import {
  Visitor,
  Visit,
  VisitorAction,
  DashboardStats,
  Space,
  Penalty,
  PenaltyType,
  Program,
  ProgramAttendance,
} from '../types';

// Mock DB keys
const STORAGE_KEY_VISITORS = 'centerflow_visitors';
const STORAGE_KEY_VISITS = 'centerflow_visits';
const STORAGE_KEY_SPACES = 'centerflow_spaces';
const STORAGE_KEY_PENALTIES = 'centerflow_penalties';
const STORAGE_KEY_PROGRAMS = 'centerflow_programs';
const STORAGE_KEY_PROGRAM_ATTENDANCES = 'centerflow_program_attendances';

// Helper to generate UUID-like strings
const generateId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

// Load data
const getVisitors = (): Visitor[] => {
  const data = localStorage.getItem(STORAGE_KEY_VISITORS);
  return data ? JSON.parse(data) : [];
};

const getVisits = (): Visit[] => {
  const data = localStorage.getItem(STORAGE_KEY_VISITS);
  return data ? JSON.parse(data) : [];
};

const getSpaces = (): Space[] => {
  const data = localStorage.getItem(STORAGE_KEY_SPACES);
  if (data) return JSON.parse(data);

  // Default spaces configuration for demo
  const defaults: Space[] = [
    { id: 'space-coworking', name: '코워킹 존', capacity: 40, type: 'Coworking', is_active: true },
    { id: 'space-meeting-a', name: '회의실 A', capacity: 8, type: 'Meeting', is_active: true },
    { id: 'space-meeting-b', name: '회의실 B', capacity: 6, type: 'Meeting', is_active: true },
  ];
  localStorage.setItem(STORAGE_KEY_SPACES, JSON.stringify(defaults));
  return defaults;
};

const getPenalties = (): Penalty[] => {
  const data = localStorage.getItem(STORAGE_KEY_PENALTIES);
  return data ? JSON.parse(data) : [];
};

const getProgramsInternal = (): Program[] => {
  const data = localStorage.getItem(STORAGE_KEY_PROGRAMS);
  if (data) return JSON.parse(data);

  // Default demo programs (today)
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    9,
    0,
    0,
  ).toISOString();
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    18,
    0,
    0,
  ).toISOString();

  const defaults: Program[] = [
    {
      id: 'program-startup-mentoring',
      name: '스타트업 1:1 멘토링',
      description: '초기 창업팀을 위한 전문가 멘토링 세션',
      start_at: startOfDay,
      end_at: endOfDay,
      capacity: 20,
      is_active: true,
    },
    {
      id: 'program-networking',
      name: '청년 네트워킹 데이',
      description: '입주팀 및 외부 청년 네트워킹 행사',
      start_at: startOfDay,
      end_at: endOfDay,
      capacity: 40,
      is_active: true,
    },
  ];

  localStorage.setItem(STORAGE_KEY_PROGRAMS, JSON.stringify(defaults));
  return defaults;
};

const getProgramAttendancesInternal = (): ProgramAttendance[] => {
  const data = localStorage.getItem(STORAGE_KEY_PROGRAM_ATTENDANCES);
  return data ? JSON.parse(data) : [];
};

const saveVisitors = (visitors: Visitor[]) =>
  localStorage.setItem(STORAGE_KEY_VISITORS, JSON.stringify(visitors));
const saveVisits = (visits: Visit[]) =>
  localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(visits));
const saveSpaces = (spaces: Space[]) =>
  localStorage.setItem(STORAGE_KEY_SPACES, JSON.stringify(spaces));
const savePenalties = (penalties: Penalty[]) =>
  localStorage.setItem(STORAGE_KEY_PENALTIES, JSON.stringify(penalties));
const savePrograms = (programs: Program[]) =>
  localStorage.setItem(STORAGE_KEY_PROGRAMS, JSON.stringify(programs));
const saveProgramAttendances = (attendances: ProgramAttendance[]) =>
  localStorage.setItem(
    STORAGE_KEY_PROGRAM_ATTENDANCES,
    JSON.stringify(attendances),
  );

// --- API Methods ---

export const findVisitorByPhone = async (
  phone: string,
): Promise<Visitor | undefined> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  const visitors = getVisitors();
  return visitors.find((v) => {
    const pn = v.phone_number || '';
    // 기존 전체 번호 저장 데이터와, 새 8자리 저장 데이터를 모두 지원
    return pn === phone || pn.slice(-phone.length) === phone;
  });
};

export interface CreateVisitorInput {
  phone: string;
  name: string;
  birth_date?: string;
  address?: string;
  is_startup?: boolean;
  notes?: string;
  terms_accepted_at?: string;
}

export const createVisitor = async (
  input: CreateVisitorInput,
): Promise<Visitor> => {
  const visitors = getVisitors();
  const newVisitor: Visitor = {
    id: generateId(),
    phone_number: input.phone,
    name: input.name,
    created_at: new Date().toISOString(),
    birth_date: input.birth_date,
    address: input.address,
    is_startup: input.is_startup,
    notes: input.notes,
    terms_accepted_at: input.terms_accepted_at,
  };
  visitors.push(newVisitor);
  saveVisitors(visitors);

  // Notify dashboards that visitor data changed
  window.dispatchEvent(new Event('db-update'));

  return newVisitor;
};

export const getLastActiveVisit = async (visitorId: string): Promise<Visit | undefined> => {
  const visits = getVisits();
  // Find a visit for this user that has no check_out_at
  return visits.find(v => v.visitor_id === visitorId && v.status === 'active');
};

export const checkIn = async (
  visitor: Visitor,
  purpose: Visit['purpose'],
  spaceId?: string,
  programId?: string,
): Promise<Visit> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const visits = getVisits();
  const spaces = getSpaces();
  const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
  const programs = getProgramsInternal();
  const program = programId
    ? programs.find((p) => p.id === programId)
    : undefined;
  
  const newVisit: Visit = {
    id: generateId(),
    visitor_id: visitor.id,
    visitor_name: visitor.name,
    check_in_at: new Date().toISOString(),
    check_out_at: null,
    purpose,
    status: 'active',
    space_id: spaceId,
    space_name: space?.name,
    program_id: programId,
    program_name: program?.name,
  };
  
  visits.push(newVisit);
  saveVisits(visits);

  if (programId && program) {
    const attendances = getProgramAttendancesInternal();
    const attendance: ProgramAttendance = {
      id: generateId(),
      program_id: programId,
      visitor_id: visitor.id,
      visit_id: newVisit.id,
      created_at: new Date().toISOString(),
    };
    attendances.push(attendance);
    saveProgramAttendances(attendances);
  }
  
  // Trigger update event for dashboard
  window.dispatchEvent(new Event('db-update'));
  
  return newVisit;
};

export const checkOut = async (visitId: string): Promise<Visit> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const visits = getVisits();
  const visitIndex = visits.findIndex(v => v.id === visitId);
  
  if (visitIndex === -1) throw new Error("Visit not found");
  
  const updatedVisit = {
    ...visits[visitIndex],
    check_out_at: new Date().toISOString(),
    status: 'completed' as const,
  };
  
  visits[visitIndex] = updatedVisit;
  saveVisits(visits);

  // Trigger update event for dashboard
  window.dispatchEvent(new Event('db-update'));

  return updatedVisit;
};

export const getStats = async (): Promise<DashboardStats> => {
  const visits = getVisits();
  const today = new Date().toDateString();
  
  const todaysVisits = visits.filter(v => new Date(v.check_in_at).toDateString() === today);
  const activeVisits = visits.filter(v => v.status === 'active');
  const completedVisits = todaysVisits.filter(v => v.status === 'completed' && v.check_out_at);
  
  let totalDuration = 0;
  completedVisits.forEach(v => {
    if (v.check_out_at) {
      const start = new Date(v.check_in_at).getTime();
      const end = new Date(v.check_out_at).getTime();
      totalDuration += (end - start);
    }
  });
  
  const averageDurationMinutes = completedVisits.length > 0 
    ? Math.round((totalDuration / 1000 / 60) / completedVisits.length) 
    : 0;

  return {
    currentOccupancy: activeVisits.length,
    totalVisitsToday: todaysVisits.length,
    averageDurationMinutes,
  };
};

export const getActiveVisits = async (): Promise<Visit[]> => {
  return getVisits().filter(v => v.status === 'active').sort((a, b) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime());
};

export const getAllVisits = async (): Promise<Visit[]> => {
  return getVisits().sort(
    (a, b) =>
      new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime(),
  );
};

export const deleteVisit = async (visitId: string): Promise<void> => {
  const visits = getVisits();
  const next = visits.filter((v) => v.id !== visitId);
  if (next.length === visits.length) return;
  saveVisits(next);
  window.dispatchEvent(new Event('db-update'));
};

export const updateVisit = async (
  visitId: string,
  update: Partial<Visit>,
): Promise<Visit> => {
  const visits = getVisits();
  const index = visits.findIndex((v) => v.id === visitId);
  if (index === -1) {
    throw new Error('Visit not found');
  }
  const updated: Visit = { ...visits[index], ...update };
  visits[index] = updated;
  saveVisits(visits);
  window.dispatchEvent(new Event('db-update'));
  return updated;
};

export const getAllVisitors = async (): Promise<Visitor[]> => {
  return getVisitors().sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

export const getSpacesWithOccupancy = async (): Promise<(Space & { currentOccupancy: number })[]> => {
  const spaces = getSpaces();
  const visits = getVisits();

  return spaces.map((space) => {
    const currentOccupancy = visits.filter(
      (v) => v.status === 'active' && v.space_id === space.id,
    ).length;
    return { ...space, currentOccupancy };
  });
};

export const updateSpace = async (
  spaceId: string,
  update: Partial<Space>,
): Promise<Space> => {
  const spaces = getSpaces();
  const index = spaces.findIndex((s) => s.id === spaceId);
  if (index === -1) {
    throw new Error('Space not found');
  }
  const updated: Space = { ...spaces[index], ...update };
  spaces[index] = updated;
  saveSpaces(spaces);
  window.dispatchEvent(new Event('db-update'));
  return updated;
};

// Penalties / sanctions
export const getAllPenalties = async (): Promise<Penalty[]> => {
  return getPenalties().sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

export const addPenalty = async (
  visitorId: string,
  type: PenaltyType,
  reason: string,
): Promise<Penalty> => {
  const penalties = getPenalties();
  const penalty: Penalty = {
    id: generateId(),
    visitor_id: visitorId,
    type,
    reason,
    created_at: new Date().toISOString(),
    active: true,
  };
  penalties.push(penalty);
  savePenalties(penalties);

  window.dispatchEvent(new Event('db-update'));

  return penalty;
};

export const updatePenalty = async (
  penaltyId: string,
  update: Partial<Penalty>,
): Promise<Penalty> => {
  const penalties = getPenalties();
  const index = penalties.findIndex((p) => p.id === penaltyId);
  if (index === -1) {
    throw new Error('Penalty not found');
  }
  const updated: Penalty = { ...penalties[index], ...update };
  penalties[index] = updated;
  savePenalties(penalties);
  window.dispatchEvent(new Event('db-update'));
  return updated;
};

export const getActivePenaltyForVisitor = async (
  visitorId: string,
): Promise<Penalty | undefined> => {
  const penalties = getPenalties();
  return penalties.find(
    (p) => p.visitor_id === visitorId && p.active && p.type === 'suspension',
  );
};

// Programs / events
export const getPrograms = async (): Promise<Program[]> => {
  return getProgramsInternal().sort(
    (a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
};

export const createProgram = async (input: {
  name: string;
  description?: string;
  start_at: string;
  end_at: string;
  capacity?: number;
}): Promise<Program> => {
  const programs = getProgramsInternal();
  const program: Program = {
    id: generateId(),
    name: input.name,
    description: input.description,
    start_at: input.start_at,
    end_at: input.end_at,
    capacity: input.capacity,
    is_active: true,
  };
  programs.push(program);
  savePrograms(programs);
  window.dispatchEvent(new Event('db-update'));
  return program;
};

export const getProgramAttendances = async (
  programId: string,
): Promise<ProgramAttendance[]> => {
  const attendances = getProgramAttendancesInternal();
  return attendances.filter((a) => a.program_id === programId);
};

// Subscription helper for dashboard
export const subscribeToUpdates = (callback: () => void) => {
  window.addEventListener('db-update', callback);
  return () => window.removeEventListener('db-update', callback);
};

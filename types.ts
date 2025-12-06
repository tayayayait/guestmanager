export interface Visitor {
  id: string;
  phone_number: string;
  name: string;
  created_at: string;
  // Optional extended profile fields
  birth_date?: string;
  address?: string;
  is_startup?: boolean;
  notes?: string;
  terms_accepted_at?: string;
}

export interface Space {
  id: string;
  name: string;
  capacity: number;
  type?: 'Coworking' | 'Meeting' | 'Event' | 'Other';
  is_active?: boolean;
}

export interface Visit {
  id: string;
  visitor_id: string;
  visitor_name: string; // Denormalized for easier display in mock
  check_in_at: string;
  check_out_at: string | null;
  purpose: 'Study' | 'Meeting' | 'Rest' | 'Event' | 'Other';
  status: 'active' | 'completed';
  space_id?: string;
  space_name?: string;
  program_id?: string;
  program_name?: string;
}

export type PenaltyType = 'warning' | 'suspension';

export interface Penalty {
  id: string;
  visitor_id: string;
  type: PenaltyType;
  reason: string;
  created_at: string;
  active: boolean;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  start_at: string;
  end_at: string;
  capacity?: number;
  is_active: boolean;
}

export interface ProgramAttendance {
  id: string;
  program_id: string;
  visitor_id: string;
  visit_id: string;
  created_at: string;
}

export type VisitorAction = 
  | { type: 'CHECK_IN_NEW'; visitor: Visitor; visit: Visit }
  | { type: 'CHECK_IN_RETURNING'; visit: Visit }
  | { type: 'CHECK_OUT'; visit: Visit; durationMinutes: number };

export interface DashboardStats {
  currentOccupancy: number;
  totalVisitsToday: number;
  averageDurationMinutes: number;
}

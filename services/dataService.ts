import {
  findVisitorByPhone as dbFindVisitorByPhone,
  createVisitor as dbCreateVisitor,
  checkIn as dbCheckIn,
  checkOut as dbCheckOut,
  getLastActiveVisit as dbGetLastActiveVisit,
  getStats as dbGetStats,
  getActiveVisits as dbGetActiveVisits,
  getAllVisits as dbGetAllVisits,
  deleteVisit as dbDeleteVisit,
  updateVisit as dbUpdateVisit,
  getAllVisitors as dbGetAllVisitors,
  subscribeToUpdates as dbSubscribeToUpdates,
  CreateVisitorInput,
  getSpacesWithOccupancy as dbGetSpacesWithOccupancy,
  getAllPenalties as dbGetAllPenalties,
  addPenalty as dbAddPenalty,
  updatePenalty as dbUpdatePenalty,
  getActivePenaltyForVisitor as dbGetActivePenaltyForVisitor,
  getPrograms as dbGetPrograms,
  createProgram as dbCreateProgram,
  getProgramAttendances as dbGetProgramAttendances,
  updateSpace as dbUpdateSpace,
} from './mockDb';
import * as httpApi from './httpApiClient';
import { Visit } from '../types';

export type { CreateVisitorInput };

const USE_HTTP_API = import.meta.env.VITE_API_MODE === 'api';

// Kiosk-related operations
export const findVisitorByPhone: typeof dbFindVisitorByPhone = (...args) =>
  USE_HTTP_API ? httpApi.findVisitorByPhone(...args) : dbFindVisitorByPhone(...args);

export const createVisitor: typeof dbCreateVisitor = (...args) =>
  USE_HTTP_API ? httpApi.createVisitor(...args) : dbCreateVisitor(...args);

export const checkIn: typeof dbCheckIn = (...args) =>
  USE_HTTP_API ? httpApi.checkIn(...args) : dbCheckIn(...args);

export const checkOut: typeof dbCheckOut = (...args) =>
  USE_HTTP_API ? httpApi.checkOut(...args) : dbCheckOut(...args);

export const getLastActiveVisit: typeof dbGetLastActiveVisit = (...args) =>
  USE_HTTP_API ? httpApi.getLastActiveVisit(...args) : dbGetLastActiveVisit(...args);

// Dashboard-related operations
export const getStats: typeof dbGetStats = (...args) =>
  USE_HTTP_API ? httpApi.getStats(...args) : dbGetStats(...args);

export const getActiveVisits: typeof dbGetActiveVisits = (...args) =>
  USE_HTTP_API ? httpApi.getActiveVisits(...args) : dbGetActiveVisits(...args);

export const getAllVisits: typeof dbGetAllVisits = (...args) =>
  USE_HTTP_API ? httpApi.getAllVisits(...args) : dbGetAllVisits(...args);

export const deleteVisit: typeof dbDeleteVisit = (...args) =>
  USE_HTTP_API ? httpApi.deleteVisit(...args) : dbDeleteVisit(...args);

export const updateVisit: typeof dbUpdateVisit = (...args) =>
  USE_HTTP_API ? httpApi.updateVisit(...args) : dbUpdateVisit(...args);

export const getAllVisitors: typeof dbGetAllVisitors = (...args) =>
  USE_HTTP_API ? httpApi.getAllVisitors(...args) : dbGetAllVisitors(...args);

export const subscribeToUpdates = (callback: () => void) =>
  USE_HTTP_API ? () => {} : dbSubscribeToUpdates(callback);

export const getSpacesWithOccupancy: typeof dbGetSpacesWithOccupancy = (...args) =>
  USE_HTTP_API ? httpApi.getSpacesWithOccupancy(...args) : dbGetSpacesWithOccupancy(...args);

export const updateSpace: typeof dbUpdateSpace = (...args) =>
  USE_HTTP_API ? httpApi.updateSpace(...args) : dbUpdateSpace(...args);

export const getAllPenalties: typeof dbGetAllPenalties = (...args) =>
  USE_HTTP_API ? httpApi.getAllPenalties(...args) : dbGetAllPenalties(...args);

export const addPenalty: typeof dbAddPenalty = (...args) =>
  USE_HTTP_API ? httpApi.addPenalty(...args) : dbAddPenalty(...args);

export const updatePenalty: typeof dbUpdatePenalty = (...args) =>
  USE_HTTP_API ? httpApi.updatePenalty(...args) : dbUpdatePenalty(...args);

export const getActivePenaltyForVisitor: typeof dbGetActivePenaltyForVisitor = (...args) =>
  USE_HTTP_API ? httpApi.getActivePenaltyForVisitor(...args) : dbGetActivePenaltyForVisitor(...args);

export const getPrograms: typeof dbGetPrograms = (...args) =>
  USE_HTTP_API ? httpApi.getPrograms(...args) : dbGetPrograms(...args);

export const createProgram: typeof dbCreateProgram = (...args) =>
  USE_HTTP_API ? httpApi.createProgram(...args) : dbCreateProgram(...args);

export const getProgramAttendances: typeof dbGetProgramAttendances = (...args) =>
  USE_HTTP_API ? httpApi.getProgramAttendances(...args) : dbGetProgramAttendances(...args);

// Helper for future expansion: compute visit duration in minutes
export const getVisitDurationMinutes = (visit: Visit): number | null => {
  if (!visit.check_out_at) return null;
  const start = new Date(visit.check_in_at).getTime();
  const end = new Date(visit.check_out_at).getTime();
  return Math.round((end - start) / 60000);
};

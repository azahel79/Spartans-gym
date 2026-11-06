import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import { getApiError } from '../utils/apiError';
import type {
  WorkoutAssignment,
  WorkoutAssignmentStatus,
  WorkoutClient,
  WorkoutLevel,
  WorkoutRoutine,
  WorkoutTrainer,
} from '../types';

export type RoutinePayload = {
  trainerId?: number;
  name: string;
  level: WorkoutLevel;
  objective: string;
  durationWeeks: number;
  daysPerWeek: number;
  sessionTimeMinutes?: number | null;
  notes?: string;
  days: WorkoutRoutine['days'];
};

type AssignPayload = {
  routineId: string;
  clientId: string;
  startDate: string;
  endDate?: string;
  clientNotes?: string;
};

interface WorkoutState {
  routines: WorkoutRoutine[];
  assignments: WorkoutAssignment[];
  clients: WorkoutClient[];
  trainers: WorkoutTrainer[];
  isLoading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  fetchRoutines: () => Promise<void>;
  fetchAssignments: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchTrainers: () => Promise<void>;
  createRoutine: (payload: RoutinePayload) => Promise<WorkoutRoutine>;
  updateRoutine: (id: string, payload: RoutinePayload) => Promise<WorkoutRoutine>;
  deleteRoutine: (id: string) => Promise<void>;
  assignRoutine: (payload: AssignPayload) => Promise<WorkoutAssignment>;
  updateAssignmentStatus: (id: string, status: WorkoutAssignmentStatus) => Promise<WorkoutAssignment>;
}

export const useWorkoutStore = create<WorkoutState>()(
  devtools(
    (set, get) => ({
      routines: [],
      assignments: [],
      clients: [],
      trainers: [],
      isLoading: false,
      error: null,

      fetchAll: async () => {
        await Promise.all([get().fetchRoutines(), get().fetchAssignments(), get().fetchClients(), get().fetchTrainers()]);
      },

      fetchRoutines: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<{ data: WorkoutRoutine[] }>('/workouts/routines');
          set({ routines: response.data.data, isLoading: false });
        } catch (error) {
          set({ error: getApiError(error, 'Error al cargar rutinas'), isLoading: false });
          throw error;
        }
      },

      fetchAssignments: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<{ data: WorkoutAssignment[] }>('/workouts/assignments');
          set({ assignments: response.data.data, isLoading: false });
        } catch (error) {
          set({ error: getApiError(error, 'Error al cargar asignaciones'), isLoading: false });
          throw error;
        }
      },

      fetchClients: async () => {
        try {
          const response = await api.get<{ data: WorkoutClient[] }>('/workouts/clients');
          set({ clients: response.data.data });
        } catch (error) {
          set({ error: getApiError(error, 'Error al cargar clientes') });
        }
      },

      fetchTrainers: async () => {
        try {
          const response = await api.get<{ data: WorkoutTrainer[] }>('/workouts/trainers');
          set({ trainers: response.data.data });
        } catch (error) {
          set({ trainers: [], error: getApiError(error, 'Error al cargar entrenadores') });
        }
      },

      createRoutine: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ data: WorkoutRoutine }>('/workouts/routines', payload);
          const routine = response.data.data;
          set((state) => ({ routines: [routine, ...state.routines], isLoading: false }));
          return routine;
        } catch (error) {
          set({ error: getApiError(error, 'No se pudo crear la rutina'), isLoading: false });
          throw error;
        }
      },

      updateRoutine: async (id, payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.put<{ data: WorkoutRoutine }>(`/workouts/routines/${id}`, payload);
          const routine = response.data.data;
          set((state) => ({
            routines: state.routines.map((item) => item.id === id ? routine : item),
            assignments: state.assignments.map((item) => item.routineId === id ? { ...item, routine } : item),
            isLoading: false,
          }));
          return routine;
        } catch (error) {
          set({ error: getApiError(error, 'No se pudo actualizar la rutina'), isLoading: false });
          throw error;
        }
      },

      deleteRoutine: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await api.delete(`/workouts/routines/${id}`);
          set((state) => ({ routines: state.routines.filter((item) => item.id !== id), isLoading: false }));
        } catch (error) {
          set({ error: getApiError(error, 'No se pudo archivar la rutina'), isLoading: false });
          throw error;
        }
      },

      assignRoutine: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ data: WorkoutAssignment }>('/workouts/assignments', payload);
          const assignment = response.data.data;
          set((state) => ({ assignments: [assignment, ...state.assignments], isLoading: false }));
          return assignment;
        } catch (error) {
          set({ error: getApiError(error, 'No se pudo asignar la rutina'), isLoading: false });
          throw error;
        }
      },

      updateAssignmentStatus: async (id, status) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.patch<{ data: WorkoutAssignment }>(`/workouts/assignments/${id}/status`, { status });
          const assignment = response.data.data;
          set((state) => ({
            assignments: state.assignments.map((item) => item.id === id ? assignment : item),
            isLoading: false,
          }));
          return assignment;
        } catch (error) {
          set({ error: getApiError(error, 'No se pudo actualizar la asignacion'), isLoading: false });
          throw error;
        }
      },
    }),
    { name: 'workout-store' }
  )
);

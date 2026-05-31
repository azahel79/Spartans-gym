// store/attendance.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { Attendance } from '../types';

interface AttendanceFilters {
  fechaInicio?: string;
  fechaFin?: string;
  status?: string;
  plan?: string;
  search?: string;
}

interface AttendanceState {
  attendances: Attendance[];
  isLoading: boolean;
  error: string | null;
  fetchAttendances: (filters?: AttendanceFilters) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>()(
  devtools(
    (set) => ({
      attendances: [],
      isLoading: false,
      error: null,

      fetchAttendances: async (filters) => {
        set({ isLoading: true, error: null });
        try {
          let url = '/attendances';

          if (filters) {
            const params = new URLSearchParams();
            if (filters.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
            if (filters.fechaFin) params.append('fechaFin', filters.fechaFin);
            if (filters.status && filters.status !== 'Todos') params.append('status', filters.status);
            if (filters.plan && filters.plan !== 'Cualquiera' && filters.plan !== 'Todos los planes') params.append('plan', filters.plan);
            if (filters.search) params.append('search', filters.search);
            if (params.toString()) url += `?${params.toString()}`;
          }

          const response = await api.get(url);
          set({
            attendances: response.data.data,
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al cargar asistencias',
            isLoading: false,
          });
        }
      },
    }),
    { name: 'attendance-store' }
  )
);

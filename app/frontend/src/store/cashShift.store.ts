import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { CashShift, CashShiftReport, CashShiftType } from '../types';
import { getApiError } from '../utils/apiError';

interface CashShiftState {
  currentShift: CashShift | null;
  report: CashShiftReport | null;
  history: CashShift[];
  suggestedShiftType: CashShiftType;
  isLoading: boolean;
  error: string | null;
  fetchCurrentShift: () => Promise<void>;
  fetchReport: () => Promise<void>;
  fetchHistory: (filters?: { dayKey?: string; userId?: number }) => Promise<void>;
  openShift: (data: { shiftType: CashShiftType; openingCash: number; openingNotes?: string }) => Promise<void>;
  closeShift: (data: { declaredCash: number; closingNotes?: string }) => Promise<CashShift>;
  downloadCsv: (shift: CashShift) => Promise<void>;
}

export const useCashShiftStore = create<CashShiftState>()(
  devtools(
    (set, get) => ({
      currentShift: null,
      report: null,
      history: [],
      suggestedShiftType: 'MORNING',
      isLoading: false,
      error: null,
      fetchCurrentShift: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/cash-shifts/current');
          set({
            currentShift: response.data.data,
            report: response.data.data?.report || null,
            suggestedShiftType: response.data.suggestedShiftType || 'MORNING',
            isLoading: false,
          });
        } catch (error) {
          set({ error: getApiError(error, 'Error al consultar el turno'), isLoading: false });
        }
      },
      fetchReport: async () => {
        if (!get().currentShift) return;
        try {
          const response = await api.get('/cash-shifts/current/report');
          set({ report: response.data.data });
        } catch (error) {
          set({ error: getApiError(error, 'Error al actualizar el reporte') });
        }
      },
      fetchHistory: async (filters) => {
        try {
          const params = new URLSearchParams();
          if (filters?.dayKey) params.set('dayKey', filters.dayKey);
          if (filters?.userId) params.set('userId', String(filters.userId));
          const response = await api.get(`/cash-shifts${params.size ? `?${params}` : ''}`);
          set({ history: response.data.data });
        } catch (error) {
          set({ error: getApiError(error, 'Error al cargar cortes') });
        }
      },
      openShift: async (data) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/cash-shifts/open', data);
          await get().fetchCurrentShift();
          await get().fetchHistory();
        } catch (error) {
          set({ error: getApiError(error, 'Error al abrir turno'), isLoading: false });
          throw error;
        }
      },
      closeShift: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/cash-shifts/current/close', data);
          const closed = response.data.data as CashShift;
          set({ currentShift: null, report: null, isLoading: false });
          await get().fetchHistory();
          return closed;
        } catch (error) {
          set({ error: getApiError(error, 'Error al cerrar turno'), isLoading: false });
          throw error;
        }
      },
      downloadCsv: async (shift) => {
        const response = await api.get(`/cash-shifts/${shift.id}/csv`, { responseType: 'blob' });
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte-corte-caja-${shift.dayKey}-${shift.shiftType.toLowerCase()}.xls`;
        link.click();
        URL.revokeObjectURL(url);
      },
    }),
    { name: 'cash-shift-store' }
  )
);

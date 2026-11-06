import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { Transaction } from '../types';
import { getApiError } from '../utils/apiError';

interface HistoryState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  fetchTransactions: (filters?: { tipo?: string; metodo?: string; fechaInicio?: string; fechaFin?: string }) => Promise<void>;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set) => ({
      transactions: [],
      isLoading: false,
      error: null,
      fetchTransactions: async (filters) => {
        set({ isLoading: true, error: null });
        try {
          const params = new URLSearchParams();
          if (filters?.tipo) params.append('tipo', filters.tipo);
          if (filters?.metodo) params.append('metodo', filters.metodo);
          if (filters?.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
          if (filters?.fechaFin) params.append('fechaFin', filters.fechaFin);
          const response = await api.get<{ data: Transaction[] }>(`/transactions${params.size ? `?${params}` : ''}`);
          set({ transactions: response.data.data, isLoading: false });
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al cargar historial'), isLoading: false });
        }
      },
      clearHistory: () => set({ transactions: [] }),
    }),
    { name: 'history-store' }
  )
);

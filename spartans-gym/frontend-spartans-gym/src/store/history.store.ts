// store/history.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { Transaction, TransactionType, PaymentMethod } from '../types';

interface HistoryState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  addTransaction: (trx: Omit<Transaction, 'id'>) => Promise<void>;
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
          let url = '/transactions';
          if (filters) {
            const params = new URLSearchParams();
            if (filters.tipo) params.append('tipo', filters.tipo);
            if (filters.metodo) params.append('metodo', filters.metodo);
            if (filters.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
            if (filters.fechaFin) params.append('fechaFin', filters.fechaFin);
            if (params.toString()) url += `?${params.toString()}`;
          }
          
          const response = await api.get(url);
          set({ 
            transactions: response.data.data, 
            isLoading: false 
          });
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || 'Error al cargar historial', 
            isLoading: false 
          });
        }
      },

      addTransaction: async (trx) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/transactions', trx);
          const newTransaction = response.data.data;
          
          set((state) => ({
            transactions: [newTransaction, ...state.transactions],
            isLoading: false,
          }));
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || 'Error al crear transacción', 
            isLoading: false 
          });
          throw err;
        }
      },

      clearHistory: () => {
        set({ transactions: [] });
      },
    }),
    { name: 'history-store' }
  )
);
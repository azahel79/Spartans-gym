// store/dashboard.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { DashboardStats } from '../types';

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  fetchDashboardStats: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set) => ({
      stats: null,
      isLoading: false,
      error: null,

      fetchDashboardStats: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/dashboard/stats');
          set({
            stats: response.data.data,
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.error || 'Error al cargar dashboard',
            isLoading: false,
          });
        }
      },
    }),
    { name: 'dashboard-store' }
  )
);

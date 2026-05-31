// store/config.store.ts (actualizar funciones de planes)

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '../config/axios';

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'recepcionista';
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  color: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GymConfig {
  id?: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  logo?: string;
}

interface ConfigState {
  users: User[];
  plans: Plan[];
  gymConfig: GymConfig;
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (email: string, password: string, role: 'admin' | 'recepcionista') => Promise<void>;
  updateUserRole: (id: number, role: 'admin' | 'recepcionista') => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  updateGymConfig: (config: Partial<GymConfig>) => Promise<void>;
  fetchGymConfig: () => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  // Planes
  fetchPlans: () => Promise<void>;
  fetchPlanById: (id: string) => Promise<Plan | null>;
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePlan: (id: string, plan: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
}

// Configuración inicial por defecto
const defaultGymConfig: GymConfig = {
  name: "SPARTAN'S GYM",
  email: 'contacto@spartansgym.com',
  phone: '+52 55 1234 5678',
  address: 'Avenida de los Deportes 123, Ciudad de México',
};

export const useConfigStore = create<ConfigState>()(
  devtools(
    persist(
      (set, get) => ({
        users: [],
        plans: [],
        gymConfig: defaultGymConfig,
        isLoading: false,
        error: null,

        // Usuarios
        fetchUsers: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.get('/users');
            set({ users: response.data.data, isLoading: false });
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al cargar usuarios', isLoading: false });
          }
        },

        createUser: async (email, password, role) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post('/users', { email, password, role });
            set((state) => ({
              users: [...state.users, response.data.data],
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al crear usuario', isLoading: false });
            throw err;
          }
        },

        updateUserRole: async (id, role) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.patch(`/users/${id}/role`, { role });
            set((state) => ({
              users: state.users.map((u) => (u.id === id ? response.data.data : u)),
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al actualizar rol', isLoading: false });
            throw err;
          }
        },

        deleteUser: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.delete(`/users/${id}`);
            set((state) => ({
              users: state.users.filter((u) => u.id !== id),
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al eliminar usuario', isLoading: false });
            throw err;
          }
        },

        // Configuración del gimnasio
        fetchGymConfig: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.get('/config/gym');
            set({ gymConfig: response.data.data, isLoading: false });
          } catch (err: any) {
            console.warn('Usando configuración local');
            set({ isLoading: false });
          }
        },

        updateGymConfig: async (config) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.put('/config/gym', config);
            set({ gymConfig: response.data.data, isLoading: false });
          } catch (err: any) {
            set((state) => ({
              gymConfig: { ...state.gymConfig, ...config },
              isLoading: false,
            }));
            throw err;
          }
        },

        uploadLogo: async (file: File) => {
          set({ isLoading: true, error: null });
          try {
            const formData = new FormData();
            formData.append('logo', file);
            const response = await api.post('/upload/logo', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            const logoUrl = response.data.data.url;
            await get().updateGymConfig({ logo: logoUrl });
            set({ isLoading: false });
            return logoUrl;
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al subir logo', isLoading: false });
            throw err;
          }
        },

        // ==================== PLANES ====================
        
        fetchPlans: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.get('/plans');
            set({ plans: response.data.data, isLoading: false });
          } catch (err: any) {
            console.error('Error al cargar planes:', err);
            set({ error: err.response?.data?.error || 'Error al cargar planes', isLoading: false });
            throw err;
          }
        },

        fetchPlanById: async (id: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.get(`/plans/${id}`);
            set({ isLoading: false });
            return response.data.data;
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al cargar plan', isLoading: false });
            throw err;
          }
        },

        addPlan: async (plan) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.post('/plans', plan);
            const newPlan = response.data.data;
            set((state) => ({
              plans: [...state.plans, newPlan],
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al crear plan', isLoading: false });
            throw err;
          }
        },

        updatePlan: async (id, updatedPlan) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.put(`/plans/${id}`, updatedPlan);
            const updated = response.data.data;
            set((state) => ({
              plans: state.plans.map((p) => (p.id === id ? updated : p)),
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al actualizar plan', isLoading: false });
            throw err;
          }
        },

        deletePlan: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.delete(`/plans/${id}`);
            set((state) => ({
              plans: state.plans.filter((p) => p.id !== id),
              isLoading: false,
            }));
          } catch (err: any) {
            set({ error: err.response?.data?.error || 'Error al eliminar plan', isLoading: false });
            throw err;
          }
        },
      }),
      {
        name: 'config-storage',
        partialize: (state) => ({ 
          gymConfig: state.gymConfig,
          users: state.users,
          // No persistir planes porque vienen del backend
        }),
      }
    ),
    { name: 'config-store' }
  )
);
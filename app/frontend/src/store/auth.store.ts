import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '../config/axios';
import { getApiError } from '../utils/apiError';

export type UserRole = 'superadmin' | 'admin' | 'recepcionista' | 'entrenador';

export const isAdminRole = (role?: UserRole | string) => role === 'admin' || role === 'superadmin';

interface User {
  email: string;
  id?: number;
  role?: UserRole;
  createdAt?: string;
}
interface AuthErrors { email?: string; password?: string; general?: string }
interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  errors: AuthErrors;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setErrors: (errors: AuthErrors) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        token: null,
        user: null,
        loading: false,
        errors: {},
        setErrors: (errors) => set({ errors }),
        login: async (email, password) => {
          set({ loading: true, errors: {} });
          try {
            const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', { email, password });
            set({ token: response.data.data.token, user: response.data.data.user, loading: false });
          } catch (error: unknown) {
            set({ loading: false, errors: { general: getApiError(error, 'Error al iniciar sesión') } });
          }
        },
        logout: () => {
          set({ token: null, user: null, errors: {} });
          localStorage.removeItem('auth-storage');
        },
      }),
      { name: 'auth-storage', partialize: (state) => ({ token: state.token, user: state.user }) }
    ),
    { name: 'auth-store' }
  )
);

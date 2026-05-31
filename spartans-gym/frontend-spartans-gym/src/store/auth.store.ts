// store/auth.store.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { api } from "../config/axios";

interface User {
  email: string;
  id?: number;
  role?: 'admin' | 'recepcionista';
  createdAt?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  errors: {
    email?: string;
    password?: string;
    general?: string;
  };
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setErrors: (errors: AuthState["errors"]) => void;
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
            const response = await api.post('/auth/login', { email, password });
            const { data } = response.data;

            set({
              token: data.token,
              user: data.user,
              loading: false,
            });
          } catch (error: any) {
            set({
              loading: false,
              errors: { 
                general: error.response?.data?.error || 'Error al iniciar sesión' 
              },
            });
          }
        },

        logout: () => {
          set({ token: null, user: null, errors: {} });
          localStorage.removeItem('auth-storage');
        },
      }),
      {
        name: "auth-storage",
        partialize: (state) => ({ token: state.token, user: state.user }),
      }
    ),
    { name: "auth-store" }
  )
);
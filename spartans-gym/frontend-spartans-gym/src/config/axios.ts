// src/config/axios.ts

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';

// =========================
// Types
// =========================

interface AuthState {
  token?: string;
}

interface AuthStorage {
  state?: AuthState;
}

// =========================
// URL base del backend
// =========================

export const API_URL: string =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// =========================
// Crear instancia de axios
// =========================

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =========================
// Interceptor para agregar token automáticamente
// =========================

api.interceptors.request.use(
  (
    config: InternalAxiosRequestConfig
  ): InternalAxiosRequestConfig => {
    // Obtener token del localStorage (Zustand persist)
    const authStorage: string | null =
      localStorage.getItem('auth-storage');

    if (authStorage) {
      try {
        const parsed: AuthStorage = JSON.parse(authStorage);

        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`;
        }
      } catch (e: unknown) {
        console.error('Error al parsear auth-storage', e);
      }
    }

    return config;
  },
  (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
);

// =========================
// Interceptor para manejar errores globales
// =========================

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,

  (error: AxiosError): Promise<AxiosError> => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('auth-storage');
      window.location.href = '/auth';
    }

    return Promise.reject(error);
  }
);

// =========================
// Para subir archivos
// =========================

export const apiUpload: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

apiUpload.interceptors.request.use(
  (
    config: InternalAxiosRequestConfig
  ): InternalAxiosRequestConfig => {
    const authStorage: string | null =
      localStorage.getItem('auth-storage');

    if (authStorage) {
      try {
        const parsed: AuthStorage = JSON.parse(authStorage);

        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`;
        }
      } catch (e: unknown) {
        console.error('Error al parsear auth-storage', e);
      }
    }

    // No setear Content-Type, axios lo hace automáticamente con FormData
    return config;
  },
  (error: AxiosError): Promise<AxiosError> => Promise.reject(error)
);
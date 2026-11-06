import axios from 'axios';

type ApiErrorBody = {
  error?: string;
  message?: string;
  details?: unknown;
};

export function getApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorBody | string>(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      if (typeof data.error === 'string' && data.error.trim()) return data.error;
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
    }

    if (error.code === 'ECONNABORTED') return 'La API tardó demasiado en responder';
    if (!error.response) return `No se pudo conectar con la API: ${error.message}`;
    if (status) return `${fallback} (HTTP ${status})`;
    return error.message || fallback;
  }

  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

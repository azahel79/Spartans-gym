import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import { getApiError } from '../utils/apiError';

export type NotificationKind = 'WELCOME' | 'EXPIRY_REMINDER' | 'EXPIRED' | 'RENEWAL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type WhatsAppSessionStatus = 'disabled' | 'idle' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'disconnected' | 'failed';

export interface WhatsAppSession {
  provider: string;
  enabled: boolean;
  status: WhatsAppSessionStatus;
  qrCodeDataUrl?: string | null;
  lastError?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  clientId: string;
  headless: boolean;
}

export interface WhatsAppNotification {
  id: number;
  clientId: string;
  kind: NotificationKind;
  status: NotificationStatus;
  dedupeKey: string;
  templateName: string;
  recipient: string;
  referenceDate?: string | null;
  daysBefore?: number | null;
  providerId?: string | null;
  error?: string | null;
  attempts: number;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    nombre: string;
    apellidos: string;
    telefono: string;
  };
}

interface NotificationState {
  notifications: WhatsAppNotification[];
  whatsAppSession: WhatsAppSession | null;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  fetchWhatsAppSession: () => Promise<void>;
  restartWhatsAppSession: () => Promise<void>;
  retryNotification: (id: number) => Promise<void>;
  scanNotifications: () => Promise<void>;
  testWhatsAppConnection: (phone: string) => Promise<{ recipient: string; providerId: string }>;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      notifications: [],
      whatsAppSession: null,
      isLoading: false,
      error: null,

      fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/notifications');
          set({ notifications: response.data.data, isLoading: false });
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al cargar notificaciones'), isLoading: false });
          throw error;
        }
      },


      fetchWhatsAppSession: async () => {
        try {
          const response = await api.get('/notifications/whatsapp-session');
          set({ whatsAppSession: response.data.data as WhatsAppSession });
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al cargar sesión de WhatsApp') });
          throw error;
        }
      },

      restartWhatsAppSession: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/notifications/whatsapp-session/restart');
          set({ whatsAppSession: response.data.data as WhatsAppSession, isLoading: false });
        } catch (error: unknown) {
          const message = getApiError(error, 'Error al reiniciar sesión de WhatsApp');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },
      retryNotification: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post(`/notifications/${id}/retry`);
          const updated = response.data.data as WhatsAppNotification;
          set((state) => ({
            notifications: state.notifications.map((item) => item.id === id ? { ...item, ...updated } : item),
            isLoading: false,
          }));
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al reintentar notificación'), isLoading: false });
          throw error;
        }
      },

      scanNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/notifications/scan');
          await get().fetchNotifications();
        } catch (error: unknown) {
          const message = getApiError(error, 'Error al revisar vencimientos');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      testWhatsAppConnection: async (phone) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/notifications/test-whatsapp', { phone });
          set({ isLoading: false });
          return response.data.data as { recipient: string; providerId: string };
        } catch (error: unknown) {
          const message = getApiError(error, 'Error al enviar mensaje de prueba');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },
    }),
    { name: 'notification-store' }
  )
);




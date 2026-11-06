import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { Client, PaymentMethod, PlanType } from '../types';
import { isToday } from '../helpers/dateHelpers';
import { getApiError } from '../utils/apiError';

interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  recentAttendances: Client[];
  isLoading: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  setSelectedClient: (client: Client | null) => void;
  addClient: (data: Omit<Client, 'id' | 'status' | 'ultimaVisita' | 'vencimiento' | 'createdAt' | 'updatedAt' | 'attendanceDate'>) => Promise<Client>;
  renewClient: (clientId: string, newPlan: PlanType, amount: number, paymentMethod: PaymentMethod) => Promise<void>;
  registerAttendance: (client: Client) => Promise<void>;
}

const normalizeClient = (client: Client & { monto: number | string }): Client => ({
  ...client,
  monto: Number(client.monto),
});

export const useClientStore = create<ClientState>()(
  devtools(
    (set) => ({
      clients: [],
      selectedClient: null,
      recentAttendances: [],
      isLoading: false,
      error: null,

      fetchClients: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get<{ data: Array<Client & { monto: number | string }> }>('/clients');
          set({ clients: response.data.data.map(normalizeClient), isLoading: false });
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al cargar clientes'), isLoading: false });
        }
      },

      setSelectedClient: (client) => set({ selectedClient: client }),

      addClient: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ data: Client & { monto: number | string } }>('/clients', data);
          const client = normalizeClient(response.data.data);
          set((state) => ({ clients: [client, ...state.clients], selectedClient: client, isLoading: false }));
          return client;
        } catch (error: unknown) {
          const message = getApiError(error, 'No se pudo guardar el cliente');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      renewClient: async (clientId, newPlan, amount, paymentMethod) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<{ data: Partial<Client> & { monto?: number | string } }>(`/clients/${clientId}/renew`, {
            newPlan,
            amount,
            paymentMethod,
          });
          const updated = { ...response.data.data, monto: Number(response.data.data.monto) };
          set((state) => ({
            clients: state.clients.map((client) => client.id === clientId ? { ...client, ...updated } : client),
            selectedClient: state.selectedClient?.id === clientId ? { ...state.selectedClient, ...updated } : state.selectedClient,
            isLoading: false,
          }));
        } catch (error: unknown) {
          set({ error: getApiError(error, 'Error al renovar membresÃ­a'), isLoading: false });
          throw error;
        }
      },

      registerAttendance: async (client) => {
        set({ isLoading: true, error: null });
        try {
          if (client.attendanceDate && isToday(client.attendanceDate)) throw new Error('El cliente ya registró asistencia hoy');
          const response = await api.post<{ data: { ultimaVisita: string; attendanceDate: string } }>(`/clients/${client.id}/attendance`);
          const updated: Client = { ...client, ...response.data.data, updatedAt: new Date().toISOString() };
          set((state) => ({
            recentAttendances: [updated, ...state.recentAttendances.filter((item) => item.id !== client.id)],
            clients: state.clients.map((item) => item.id === client.id ? updated : item),
            selectedClient: state.selectedClient?.id === client.id ? updated : state.selectedClient,
            isLoading: false,
          }));
        } catch (error: unknown) {
          const message = getApiError(error, 'Error al registrar asistencia');
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },
    }),
    { name: 'client-store' }
  )
);



// store/client.store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../config/axios';
import type { Client, PlanType, PaymentMethod } from '../types';
import { getPlanPrice, getPlanMonths } from '../config/planConfig';
import { calculateExpiryDate, formatTime, isToday } from '../helpers/dateHelpers';

interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  recentAttendances: Client[];
  isLoading: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  setSelectedClient: (client: Client | null) => void;
  addClient: (clientData: Omit<Client, 'id' | 'status' | 'ultimaVisita' | 'vencimiento' | 'createdAt' | 'updatedAt' | 'attendanceDate'>) => Promise<Client>;
  renewClient: (clientId: string, newPlan: PlanType, amount: number) => Promise<void>;
  registerAttendance: (client: Client) => Promise<void>;
}

export const useClientStore = create<ClientState>()(
  devtools(
    (set, get) => ({
      clients: [],
      selectedClient: null,
      recentAttendances: [],
      isLoading: false,
      error: null,

      fetchClients: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.get('/clients');
          const clients = response.data.data;
          
          // ✅ CONVERTIR monto a número
          const clientsWithNumbers = clients.map((c: any) => ({
            ...c,
            monto: typeof c.monto === 'string' ? parseFloat(c.monto) : c.monto,
          }));
          
          set({ 
            clients: clientsWithNumbers, 
            isLoading: false 
          });
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || 'Error al cargar clientes', 
            isLoading: false 
          });
        }
      },

      setSelectedClient: (client) => set({ selectedClient: client }),

      addClient: async (newClient) => {
        set({ isLoading: true, error: null });

        try {
          const response = await api.post('/clients', newClient);
          const savedClient = response.data.data;
          
          set((state) => ({
            clients: [savedClient, ...state.clients],
            selectedClient: savedClient,
            isLoading: false,
          }));
          
          return savedClient;
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || 'No se pudo guardar el cliente', 
            isLoading: false 
          });
          throw err;
        }
      },

      renewClient: async (clientId, newPlan, amount) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post(`/clients/${clientId}/renew`, {
            newPlan,
            amount,
            paymentMethod: get().selectedClient?.metodoPago || 'Efectivo',
          });
          
          const updatedClient = response.data.data;
          
          set((state) => ({
            clients: state.clients.map((c) => 
              c.id === clientId ? { ...c, ...updatedClient } : c
            ),
            selectedClient: state.selectedClient?.id === clientId 
              ? { ...state.selectedClient, ...updatedClient }
              : state.selectedClient,
            isLoading: false,
          }));
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || 'Error al renovar membresía', 
            isLoading: false 
          });
          throw err;
        }
      },

      // ✅ REGISTRAR ASISTENCIA CON VALIDACIÓN DE FECHA
      registerAttendance: async (client) => {
        set({ isLoading: true, error: null });
        
        try {
          // ✅ Verificar si el cliente ya asistió HOY antes de llamar al backend
          if (client.attendanceDate && isToday(client.attendanceDate)) {
            throw new Error('El cliente ya registró asistencia hoy');
          }
          
          const response = await api.post(`/clients/${client.id}/attendance`);
          const { ultimaVisita, attendanceDate } = response.data.data;
          
          const updatedClient: Client = {
            ...client,
            ultimaVisita,
            attendanceDate,
            updatedAt: new Date().toISOString(),
          };

          set((state) => ({
            recentAttendances: [updatedClient, ...state.recentAttendances.filter(a => a.attendanceDate !== attendanceDate)],
            clients: state.clients.map((c) => (c.id === client.id ? updatedClient : c)),
            selectedClient: state.selectedClient?.id === client.id ? updatedClient : state.selectedClient,
            isLoading: false,
          }));
        } catch (err: any) {
          set({ 
            error: err.response?.data?.error || err.message || 'Error al registrar asistencia', 
            isLoading: false 
          });
          throw err;
        }
      },
    }),
    { name: 'client-store' }
  )
);
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useClientStore } from '../../store/client.store';
import { useConfigStore } from '../../store/config.store';
import { useHistoryStore } from '../../store/history.store';
import { hasAttendedToday } from '../../helpers/dateHelpers';
import type { Client, PaymentMethod, PlanType } from '../../types';
import { getApiError } from '../../utils/apiError';

type Genero = Client['genero'];

const useReceptionLogic = () => {
  const { selectedClient, addClient, setSelectedClient, registerAttendance, recentAttendances, clients, fetchClients } = useClientStore();
  const renewClient = useClientStore((state) => state.renewClient);
  const { transactions, fetchTransactions } = useHistoryStore();
  const { plans, fetchPlans } = useConfigStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('Mensual');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formData, setFormData] = useState<{ nombre: string; apellidos: string; genero: Genero; telefono: string; whatsappOptIn: boolean }>({
    nombre: '',
    apellidos: '',
    genero: 'Masculino',
    telefono: '',
    whatsappOptIn: true,
  });
  const [attendanceFilter, setAttendanceFilter] = useState<'today' | 'week' | 'month'>('today');

  const effectivePlan = useMemo(() => plans.find((plan) => plan.name === selectedPlan) || plans[0], [plans, selectedPlan]);
  const effectivePlanName = effectivePlan?.name || selectedPlan;
  const currentAmount = Number(effectivePlan?.price || 0);
  const planOptions = useMemo(() => plans.map((plan) => plan.name), [plans]);

  const getDaysLeft = useCallback((vencimiento: string | Date | null | undefined) => {
    if (!vencimiento) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(vencimiento);
    if (Number.isNaN(expiry.getTime())) return null;
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  }, []);

  useEffect(() => {
    void Promise.all([fetchClients(), fetchTransactions(), fetchPlans()]);
  }, [fetchClients, fetchPlans, fetchTransactions]);

  const expiringSoonCount = useMemo(
    () => clients.filter((client) => {
      const days = getDaysLeft(client.vencimiento);
      return days !== null && days >= 0 && days <= 7;
    }).length,
    [clients, getDaysLeft]
  );
  const daysLeft = useMemo(() => (selectedClient ? getDaysLeft(selectedClient.vencimiento) : null), [selectedClient, getDaysLeft]);
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;
  const canRegisterAttendance = daysLeft !== null && daysLeft >= 0;
  const canRenewPlan = daysLeft !== null && daysLeft <= 5;
  const hasAlreadyAttendedToday = Boolean(selectedClient && hasAttendedToday(selectedClient));
  const filteredAttendances = recentAttendances;
  const renovacionesHoyCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return transactions.filter((transaction) => transaction.tipo === 'MEMBRESIA' && transaction.createdAt?.slice(0, 10) === today).length;
  }, [transactions]);

  const handleRegisterAttendance = useCallback(async () => {
    if (!selectedClient) return;
    try {
      await registerAttendance(selectedClient);
      await fetchClients();
      toast.success(`Asistencia registrada para ${selectedClient.nombre} ${selectedClient.apellidos}`);
    } catch (error: unknown) {
      toast.error(getApiError(error, 'Error al registrar asistencia'));
    }
  }, [fetchClients, registerAttendance, selectedClient]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const nombre = formData.nombre.trim();
    const apellidos = formData.apellidos.trim();
    const telefono = formData.telefono.trim();
    if (nombre.length < 2 || apellidos.length < 2) return void toast.error('Nombre y apellidos deben tener al menos 2 caracteres');
    if (!/^[0-9+\-()\s]{7,20}$/.test(telefono)) return void toast.error('Ingresa un teléfono válido');
    if (!effectivePlanName || currentAmount <= 0) return void toast.error('Selecciona un plan válido');

    try {
      const created = await addClient({
        nombre,
        apellidos,
        genero: formData.genero,
        telefono,
        whatsappOptIn: formData.whatsappOptIn,
        plan: effectivePlanName,
        metodoPago: paymentMethod,
        monto: currentAmount,
      });
      setSelectedClient(created);
      setIsModalOpen(false);
      setFormData({ nombre: '', apellidos: '', genero: 'Masculino', telefono: '', whatsappOptIn: true });
      await Promise.all([fetchClients(), fetchTransactions()]);
      toast.success(`Cliente ${created.nombre} ${created.apellidos} registrado exitosamente`);
    } catch (error: unknown) {
      toast.error(getApiError(error, 'Error al registrar cliente'));
    }
  }, [addClient, currentAmount, effectivePlanName, fetchClients, fetchTransactions, formData, paymentMethod, setSelectedClient]);

  const handleRenewSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient || !effectivePlanName || currentAmount <= 0) return;
    try {
      await renewClient(selectedClient.id, effectivePlanName, currentAmount, paymentMethod);
      setIsRenewModalOpen(false);
      await Promise.all([fetchClients(), fetchTransactions()]);
      toast.success('Membresía renovada exitosamente');
    } catch (error: unknown) {
      toast.error(getApiError(error, 'Error al renovar membresía'));
    }
  }, [currentAmount, effectivePlanName, fetchClients, fetchTransactions, paymentMethod, renewClient, selectedClient]);

  return {
    selectedClient, clients, recentAttendances, selectedDate, setSelectedDate, isModalOpen, setIsModalOpen,
    isRenewModalOpen, setIsRenewModalOpen, selectedPlan: effectivePlanName, setSelectedPlan, paymentMethod, setPaymentMethod,
    formData, setFormData, currentAmount, daysLeft, attendanceFilter, setAttendanceFilter, filteredAttendances,
    expiringSoonCount, renovacionesHoyCount, isExpiringSoon, getDaysLeft, hasAlreadyAttendedToday,
    canRegisterAttendance, canRenewPlan, handleRegisterAttendance, handleSubmit, handleRenewSubmit,
    setSelectedClient, planOptions,
  };
};

export default useReceptionLogic;

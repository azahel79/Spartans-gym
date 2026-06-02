// hooks/reception/useReceptionLogic.ts
import { useMemo, useState, useCallback, useEffect } from "react";
import { useClientStore } from "../../store/client.store";
import { useHistoryStore } from "../../store/history.store";
import { useConfigStore } from "../../store/config.store";
import { toast } from "react-toastify";
import { hasAttendedToday } from "../../helpers/dateHelpers";
import type { Client, PaymentMethod, PlanType } from "../../types";

type Genero = Client['genero'];

const useReceptionLogic = () => {
  const { 
    selectedClient, 
    addClient, 
    setSelectedClient, 
    registerAttendance, 
    recentAttendances,
    clients,
    fetchClients
  } = useClientStore();
  
  const renewClient = useClientStore(state => state.renewClient);
  const { addTransaction, transactions, fetchTransactions } = useHistoryStore();
  const { plans, fetchPlans } = useConfigStore();

  // Estados locales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('Mensual');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [formData, setFormData] = useState<{
    nombre: string;
    apellidos: string;
    genero: Genero;
    telefono: string;
  }>({
    nombre: '',
    apellidos: '',
    genero: 'Masculino',
    telefono: ''
  });
  const [attendanceFilter, setAttendanceFilter] = useState<'today' | 'week' | 'month'>('today');




  
  // ✅ OBTENER PRECIO DINÁMICO DESDE LOS PLANES
  const currentAmount = useMemo(() => {
    const plan = plans.find(p => p.name === selectedPlan);
    return plan?.price || 0;
  }, [selectedPlan, plans]);

  // ✅ OBTENER LISTA DE NOMBRES DE PLANES PARA EL SELECT
  const planOptions = useMemo(() => {
    return plans.map(plan => plan.name);
  }, [plans]);

  // Función auxiliar para días restantes
  const getDaysLeft = useCallback((vencimiento: any) => {
    if (!vencimiento) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaVencimiento = new Date(vencimiento);
    if (isNaN(fechaVencimiento.getTime())) return null;
    fechaVencimiento.setHours(0, 0, 0, 0);
    const diferenciaMs = fechaVencimiento.getTime() - hoy.getTime();
    const dias = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));
    return dias;
  }, []);

  // Cargar datos al montar
  useEffect(() => {
    fetchClients();
    fetchTransactions();
    fetchPlans(); // 👈 Cargar planes desde el backend
  }, []);

  // Clientes próximos a vencer
  const expiringSoonCount = useMemo(() => {
    return clients.filter(client => {
      const daysLeft = getDaysLeft(client.vencimiento);
      return daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
    }).length;
  }, [clients, getDaysLeft]);

  const isExpiringSoon = useMemo(() => {
    const days = selectedClient ? getDaysLeft(selectedClient.vencimiento) : null;
    return days !== null && days <= 5 && days >= 0;
  }, [selectedClient, getDaysLeft]);

  const daysLeft = useMemo(() => {
    return selectedClient ? getDaysLeft(selectedClient.vencimiento) : null;
  }, [selectedClient, getDaysLeft]);

  const canRegisterAttendance = daysLeft !== null && daysLeft >= 0;
  const canRenewPlan = daysLeft !== null && daysLeft <= 5;

  const renovacionesHoyCount = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    return transactions.filter(t => t.tipo === 'MEMBRESIA' && t.fecha === todayStr).length;
  }, [transactions]);

  const filteredAttendances = useMemo(() => {
    return recentAttendances;
  }, [recentAttendances]);

   const hasAlreadyAttendedToday = useMemo(() => {
    if (!selectedClient) return false;
    return hasAttendedToday(selectedClient);
  }, [selectedClient]);

  // Registrar asistencia
  const handleRegisterAttendance = useCallback(async () => {
    if (!selectedClient) return;
    
    try {
      await registerAttendance(selectedClient);
      await fetchClients();
      await fetchTransactions();
      
      toast.success(`Asistencia registrada para ${selectedClient.nombre} ${selectedClient.apellidos}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al registrar asistencia');
    }
  }, [selectedClient, registerAttendance, fetchClients, fetchTransactions, addTransaction]);

  // Crear cliente
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.apellidos || !formData.telefono) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    const now = new Date();

    const newClientData = {
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      genero: formData.genero,
      telefono: formData.telefono,
      plan: selectedPlan,
      metodoPago: paymentMethod,
      monto: currentAmount,
    };

    try {
      const createdClient = await addClient(newClientData);
      
      await addTransaction({
        clienteId: createdClient.id,
        nombre: createdClient.nombre,
        apellidos: createdClient.apellidos,
        fecha: now.toLocaleDateString(),
        hora: now.toLocaleTimeString(),
        concepto: `Inscripción - Plan ${selectedPlan}`,
        metodo: paymentMethod,
        monto: currentAmount,
        tipo: 'MEMBRESIA'
      });

      if (createdClient) setSelectedClient(createdClient);
      setIsModalOpen(false);
      
      await fetchClients();
      await fetchTransactions();
      
      toast.success(`Cliente ${formData.nombre} ${formData.apellidos} registrado exitosamente`);
      
      setFormData({ nombre: '', apellidos: '', genero: 'Masculino', telefono: '' });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al registrar cliente');
    }
  }, [formData, selectedPlan, paymentMethod, currentAmount, addClient, addTransaction, setSelectedClient, fetchClients, fetchTransactions]);

  // Renovar membresía
  const handleRenewSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      await renewClient(selectedClient.id, selectedPlan, currentAmount);
      
      await addTransaction({
        clienteId: selectedClient.id,
        nombre: selectedClient.nombre,
        apellidos: selectedClient.apellidos,
        fecha: new Date().toLocaleDateString(),
        hora: new Date().toLocaleTimeString(),
        concepto: `Renovación de membresía - Plan ${selectedPlan}`,
        metodo: paymentMethod,
        monto: currentAmount,
        tipo: 'MEMBRESIA'
      });

      setIsRenewModalOpen(false);
      
      await fetchClients();
      await fetchTransactions();
      
      toast.success('Membresía renovada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al renovar membresía');
    }
  }, [selectedClient, selectedPlan, currentAmount, paymentMethod, renewClient, addTransaction, fetchClients, fetchTransactions]);

  return {
    selectedClient, clients, recentAttendances,
    selectedDate, setSelectedDate,
    isModalOpen, setIsModalOpen,
    isRenewModalOpen, setIsRenewModalOpen,
    selectedPlan, setSelectedPlan,
    paymentMethod, setPaymentMethod,
    formData, setFormData,
    currentAmount, daysLeft,
    attendanceFilter, setAttendanceFilter, filteredAttendances,
    expiringSoonCount, renovacionesHoyCount, isExpiringSoon,
    getDaysLeft,
    hasAlreadyAttendedToday, canRegisterAttendance, canRenewPlan,
    handleRegisterAttendance, handleSubmit, handleRenewSubmit,
    setSelectedClient,
    planOptions // 👈 Exportar opciones de planes
  };
};

export default useReceptionLogic;

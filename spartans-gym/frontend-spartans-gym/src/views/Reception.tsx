// views/Reception.tsx
import React, { useMemo, useEffect } from 'react';
import { useClientStore } from '../store/client.store';
import { useHistoryStore } from '../store/history.store';
import { isToday, formatISODate } from '../helpers/dateHelpers';
import useReceptionLogic from '../hooks/reception/useReceptionLogic';
import ModalInscription from '../components/modals/ModalInscription';
import ModalRenew from '../components/modals/ModalRenew';
import { fechaFormateada } from '../helpers/getDaysLeft';

export const Reception = () => {
  const { clients, fetchClients } = useClientStore();
  const { fetchTransactions } = useHistoryStore();
  
  const {
    setIsModalOpen,
    selectedClient,
    isExpiringSoon,
    getDaysLeft,
    handleRegisterAttendance,
    canRegisterAttendance,
    currentAmount,
    selectedPlan,
    hasAlreadyAttendedToday,
    setIsRenewModalOpen,
    canRenewPlan,
    renovacionesHoyCount,
    setSelectedClient,
    isModalOpen,
    isRenewModalOpen,
    handleRenewSubmit,
    expiringSoonCount,
    setFormData,
    setPaymentMethod,
    setSelectedPlan,
    paymentMethod,
    handleSubmit,
    formData,
  } = useReceptionLogic();

  // ✅ Filtrar solo asistencias de HOY usando la zona local
  const recentAttendances = useMemo(() => {
    const todaysAttendances = clients.filter(client => {
      if (!client.attendanceDate) return false;
      return isToday(client.attendanceDate);
    });
    
    // Ordenar por hora más reciente
    return [...todaysAttendances].sort((a, b) => {
      if (!a.ultimaVisita) return 1;
      if (!b.ultimaVisita) return -1;
      return b.ultimaVisita.localeCompare(a.ultimaVisita);
    });
  }, [clients]);

  // Cargar datos al montar
  useEffect(() => {
    fetchClients();
    fetchTransactions();
  }, []);

  // Calcular días restantes para mostrar
  const daysLeftValue = selectedClient ? getDaysLeft(selectedClient.vencimiento) : null;
  const isExpiring = daysLeftValue !== null && daysLeftValue <= 5 && daysLeftValue >= 0;

  return (
    <main className="pt-20 md:pt-24 pb-12 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Principal */}
        <header className="mb-stack-lg flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">
              Panel de Recepción
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Gestión de accesos y membresías en tiempo real.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-6">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              <span className="material-symbols-outlined">person_add</span>
              Nuevo Cliente
            </button>
            <div className="sm:text-right sm:border-l sm:pl-6 border-slate-200">
              <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                Fecha de hoy
              </p>
              <p className="font-title-lg text-title-lg text-primary">
                {fechaFormateada}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Columna izquierda - Tarjeta del cliente */}
          <div className="col-span-12 lg:col-span-8 space-y-stack-md">
            {/* Tarjeta de Visualización de Cliente */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-container-padding card-shadow">
              {selectedClient ? (
                <div className="flex flex-col md:flex-row gap-stack-md">
                  <div className="relative">
                    <img
                      className="w-full max-w-[220px] h-56 md:w-48 md:h-64 object-cover rounded-[20px]"
                      src={
                        selectedClient?.fotoUrl ||
                        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop'
                      }
                      alt="Perfil"
                    />
                    <div className="absolute -bottom-3 -right-3 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold border-4 border-white">
                      ID: {selectedClient?.id?.toString().slice(0, 5) || '----'}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        {/* Alerta de Vencimiento Próximo */}
                        {isExpiring && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 animate-pulse">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            <p className="text-[11px] font-black uppercase tracking-wider">
                              ¡Atención! La membresía vence pronto
                            </p>
                          </div>
                        )}

                        <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
                          {selectedClient.nombre} {selectedClient.apellidos}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                              selectedClient?.status === 'ACTIVO' 
                                ? 'bg-secondary/10 text-secondary' 
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                selectedClient?.status === 'ACTIVO' ? 'bg-secondary' : 'bg-slate-400'
                              }`}
                            ></span>
                            {selectedClient?.status || 'SIN ESTADO'}
                          </span>
                          <span className="text-on-surface-variant font-label-lg text-label-lg">
                            • Plan {selectedClient?.plan || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-2xl font-black leading-none ${
                            daysLeftValue !== null && daysLeftValue <= 5 ? 'text-red-600' : 'text-red-600'
                          }`}
                        >
                          {daysLeftValue !== null ? `${daysLeftValue} días` : '--'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Días Restantes
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-stack-sm mb-stack-md mt-auto">
                      <div className="p-3 bg-surface-container rounded-xl">
                        <p className="text-label-sm font-label-sm text-on-surface-variant">
                          Última visita
                        </p>
                        <p className="font-title-lg text-on-surface">
                          {selectedClient?.ultimaVisita || '--:--'}
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container rounded-xl">
                        <p className="text-label-sm font-label-sm text-on-surface-variant">
                          Vencimiento
                        </p>
                        <p className="font-title-lg text-on-surface">
                          {formatISODate(selectedClient?.vencimiento)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-stack-sm">
                      {/* Botón de Asistencia */}
                      <button
                        onClick={() => selectedClient && handleRegisterAttendance()}
                        disabled={!selectedClient || hasAlreadyAttendedToday || !canRegisterAttendance}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                          !canRegisterAttendance
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                            : hasAlreadyAttendedToday
                              ? 'bg-green-100 text-green-600 cursor-not-allowed'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                        }`}
                      >
                        <span className="material-symbols-outlined">
                          {!canRegisterAttendance
                            ? 'block'
                            : hasAlreadyAttendedToday
                              ? 'check_circle'
                              : 'how_to_reg'}
                        </span>
                        {!canRegisterAttendance
                          ? 'MEMBRESÍA VENCIDA'
                          : hasAlreadyAttendedToday
                            ? 'ASISTENCIA REGISTRADA'
                            : 'REGISTRAR ASISTENCIA'}
                      </button>

                      {/* Botón de Renovación */}
                      <button
                        onClick={() => setIsRenewModalOpen(true)}
                        disabled={!selectedClient || !canRenewPlan}
                        className={`flex-1 border-2 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                          canRenewPlan
                            ? 'border-primary text-primary hover:bg-primary/5'
                            : 'border-slate-200 text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <span className="material-symbols-outlined">autorenew</span>
                        {canRenewPlan ? 'Renovar Plan' : 'Plan Vigente'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">
                    fitness_center
                  </span>
                  <p className="text-on-surface-variant text-lg font-medium">
                    Selecciona un socio
                  </p>
                  <p className="text-on-surface-variant text-sm">
                    Haz clic en un cliente de la lista para ver su información
                  </p>
                </div>
              )}
            </div>

            {/* Estadísticas Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 card-shadow">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <p className="text-display font-display text-on-surface text-3xl">
                  {recentAttendances.length}
                </p>
                <p className="text-label-lg font-label-lg text-on-surface-variant">
                  Socios hoy
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 card-shadow">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <p className="text-display font-display text-on-surface text-3xl">
                  {renovacionesHoyCount}
                </p>
                <p className="text-label-lg font-label-lg text-on-surface-variant">
                  Renovaciones
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 card-shadow">
                <div className="w-12 h-12 bg-pink-50 text-pink-700 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined">warning</span>
                </div>
                <p className="text-display font-display text-on-surface text-3xl">
                  {expiringSoonCount}
                </p>
                <p className="text-label-lg font-label-lg text-on-surface-variant">
                  Por vencer
                </p>
              </div>
            </div>
          </div>

          {/* Barra Lateral de Asistencias - CORREGIDA */}
          <div className="col-span-12 lg:col-span-4 h-full">
            <div className="bg-white border border-slate-200 rounded-[24px] card-shadow flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-title-lg text-title-lg text-on-surface">
                  Asistencia Reciente
                </h3>
                <span className="bg-emerald-50 px-2 py-1 rounded text-[10px] font-bold text-emerald-600 uppercase tracking-tighter animate-pulse">
                  En vivo
                </span>
              </div>
              <div className="p-4 overflow-y-auto max-h-[600px] space-y-4">
                {recentAttendances.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-on-surface-variant text-sm">
                      No hay registros hoy
                    </p>
                  </div>
                ) : (
                  recentAttendances.map((client) => (
                    <div
                      key={`${client.id}-${client.ultimaVisita}`}
                      onClick={() => setSelectedClient(client)}
                      className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer group ${
                        selectedClient?.id === client.id 
                          ? 'bg-primary/5 border border-primary/10' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          className="w-full h-full object-cover"
                          src={
                            client.fotoUrl ||
                            'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop'
                          }
                          alt="Avatar"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-on-surface truncate">
                          {client.nombre} {client.apellidos}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Plan {client.plan} • {client.metodoPago}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {client.ultimaVisita || '--:--'}
                        </p>
                        <span className="material-symbols-outlined text-emerald-500 text-lg">
                          check_circle
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      {isModalOpen && (
        <ModalInscription
          setIsModalOpen={setIsModalOpen}
          handleSubmit={handleSubmit}
          formData={formData}
          setFormData={setFormData}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          currentAmount={currentAmount}
        />
      )}
      
      {isRenewModalOpen && selectedClient && (
        <ModalRenew
          setIsRenewModalOpen={setIsRenewModalOpen}
          handleRenewSubmit={handleRenewSubmit}
          selectedClient={selectedClient}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          currentAmount={currentAmount}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
        />
      )}
    </main>
  );
};

export default Reception;

// views/Dashboard.tsx (Conectado al backend)
import React, { useMemo, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useInventoryStore } from '../store/inventory.store';
import { useHistoryStore } from '../store/history.store';
import { useClientStore } from '../store/client.store';
import { useDashboardStore } from '../store/dashboard.store';
import { getDaysLeft, isToday } from '../helpers/dateHelpers';
import { useAuthStore } from '../store/auth.store';

const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const chartDays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const attendanceHours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (fileName: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const getWeekdayLabel = (date: Date): string => weekDays[date.getDay()];

const getHourBucket = (date: Date): string => {
  const hour = date.getHours();
  if (hour < 10) return '08:00';
  if (hour < 12) return '10:00';
  if (hour < 14) return '12:00';
  if (hour < 16) return '14:00';
  if (hour < 18) return '16:00';
  if (hour < 20) return '18:00';
  return '20:00';
};

const Dashboard: React.FC = () => {
  const { fetchProducts } = useInventoryStore();
  const { transactions, fetchTransactions } = useHistoryStore();
  const { clients, fetchClients } = useClientStore();
  const { stats: dashboardStats, fetchDashboardStats } = useDashboardStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchProducts();
    fetchTransactions();
    fetchClients();
    fetchDashboardStats();
  }, []);

  // Recargar datos cada 30 segundos.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTransactions();
      fetchClients();
      fetchDashboardStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Convertir montos a numero antes de sumar.
  const stats = useMemo(() => {
    const totalIngresos = dashboardStats?.ingresosTotalesMes ?? transactions.reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
    const metaMensual = dashboardStats?.metaMensual ?? 60000;
    const progresoMeta = dashboardStats?.porcentajeMeta ?? Math.min((totalIngresos / metaMensual) * 100, 100);
    const activeClients = clients.filter((client) => client.status === 'ACTIVO').length;
    const todayAttendances = clients.filter((client) => isToday(client.attendanceDate)).length;
    const ocupacionActual = dashboardStats?.ocupacionActual ?? (activeClients > 0 ? Math.min(Math.round((todayAttendances / activeClients) * 100), 100) : 0);
    const totalMovimientos = dashboardStats?.totalMovimientos ?? transactions.length;

    return {
      ingresosFormateados: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalIngresos),
      porcentajeMeta: `${Math.round(progresoMeta)}%`,
      ocupacionActual,
      miembrosTotales: totalMovimientos.toLocaleString(),
      fechaHoy: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
    };
  }, [clients, dashboardStats, transactions]);

  // Proximos vencimientos.
  const proximosVencimientos = useMemo(() => {
    if (dashboardStats?.proximosVencimientos) return dashboardStats.proximosVencimientos;

    const hoy = new Date();
    return clients
      .filter((c) => {
        const dias = getDaysLeft(c.vencimiento);
        return dias !== null && dias <= 7 && dias >= 0;
      })
      .map((c) => {
        const diasFaltantes = getDaysLeft(c.vencimiento);
        return { ...c, diasFaltantes: typeof diasFaltantes === 'number' ? diasFaltantes : 999 };
      })
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
      .slice(0, 5);
  }, [clients, dashboardStats]);

  // Actividad reciente.
  const actividades = useMemo(() => {
    if (dashboardStats?.actividadReciente) return dashboardStats.actividadReciente;

    return transactions.slice(0, 5).map((t) => ({
      id: t.id,
      usuario: `${t.nombre} ${t.apellidos}`,
      accion: t.concepto,
      area: t.metodo,
      hora: t.hora,
      tipo: t.tipo === 'MEMBRESIA' ? 'check' : t.tipo === 'PRODUCTO' ? 'pago' : 'nuevo',
      monto: Number(t.monto || 0),
    }));
  }, [transactions]);

  // Datos reales de asistencia y movimientos por dia.
  const data = useMemo(() => {
    if (dashboardStats?.afluenciaPorDia) return dashboardStats.afluenciaPorDia;

    const attendanceByDay = new Map(chartDays.map((day) => [day, 0]));
    const transactionByDay = new Map(chartDays.map((day) => [day, 0]));

    clients.forEach((client) => {
      if (!client.attendanceDate) return;
      const attendanceDate = new Date(client.attendanceDate);
      if (Number.isNaN(attendanceDate.getTime())) return;
      const day = getWeekdayLabel(attendanceDate);
      attendanceByDay.set(day, (attendanceByDay.get(day) || 0) + 1);
    });

    transactions.forEach((transaction) => {
      const transactionDate = new Date(transaction.createdAt || transaction.fecha);
      if (Number.isNaN(transactionDate.getTime())) return;
      const day = getWeekdayLabel(transactionDate);
      transactionByDay.set(day, (transactionByDay.get(day) || 0) + 1);
    });

    return chartDays.map((dia) => ({
      dia,
      real: attendanceByDay.get(dia) || 0,
      proyectado: transactionByDay.get(dia) || 0,
    }));
  }, [clients, dashboardStats, transactions]);

  const ocupation = useMemo(() => {
    if (dashboardStats?.afluenciaPorHora) return dashboardStats.afluenciaPorHora;

    const attendanceByHour = new Map(attendanceHours.map((hour) => [hour, 0]));

    clients.forEach((client) => {
      if (!client.attendanceDate || !isToday(client.attendanceDate)) return;
      const attendanceDate = new Date(client.attendanceDate);
      if (Number.isNaN(attendanceDate.getTime())) return;
      const bucket = getHourBucket(attendanceDate);
      attendanceByHour.set(bucket, (attendanceByHour.get(bucket) || 0) + 1);
    });

    return attendanceHours.map((hora) => ({
      hora,
      valor: attendanceByHour.get(hora) || 0,
    }));
  }, [clients, dashboardStats]);

  const handleExport = useCallback(() => {
    const dateLabel = new Date().toISOString().slice(0, 10);
    const summaryRows = [
      ['Resumen', 'Ingresos Totales Mes', isAdmin ? stats.ingresosFormateados : 'No disponible para este rol', ''],
      ['Resumen', 'Meta Mensual', isAdmin ? '$60,000' : 'No disponible para este rol', ''],
      ['Resumen', 'Porcentaje Meta', isAdmin ? stats.porcentajeMeta : 'No disponible para este rol', ''],
      ['Resumen', 'Total Movimientos', stats.miembrosTotales, ''],
      ['Resumen', 'Ocupacion Actual', `${stats.ocupacionActual}%`, ''],
      ['Resumen', 'Fecha Exportacion', new Date().toLocaleString('es-MX'), ''],
    ];

    const expirationRows = proximosVencimientos.map((client) => [
      'Vencimiento',
      `${client.nombre} ${client.apellidos}`,
      client.plan,
      `${client.diasFaltantes} dias`,
    ]);

    const activityRows = actividades.map((activity) => [
      'Actividad',
      activity.usuario,
      activity.accion,
      `${activity.area} - ${activity.hora}`,
    ]);

    downloadCsv(`dashboard_${isAdmin ? 'admin' : 'recepcion'}_${dateLabel}.csv`, ['Seccion', 'Dato', 'Detalle', 'Extra'], [
      ...summaryRows,
      ...expirationRows,
      ...activityRows,
    ]);
  }, [isAdmin, stats, proximosVencimientos, actividades]);

  return (
    <main>
      <div className="mt-16 py-4 md:p-container-padding space-y-stack-lg max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h2 className="font-headline-lg text-on-surface">Panel de Control</h2>
            <p className="text-body-lg text-on-surface-variant">Bienvenido de nuevo. Aqui tienes el resumen de hoy.</p>
          </div>
          <div className="flex flex-wrap gap-stack-sm">
            <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              <span className="text-label-lg">Hoy, {stats.fechaHoy}</span>
            </div>
            <button
              onClick={handleExport}
              className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">file_download</span>
              <span className="text-label-lg">Exportar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Revenue Card - SOLO PARA ADMIN */}
          {isAdmin && (
            <div className="col-span-12 md:col-span-4 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-7xl text-primary">payments</span>
              </div>
              <p className="text-label-lg text-on-surface-variant mb-1">Ingresos Totales (Mes)</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-primary text-2xl font-bold">{stats.ingresosFormateados}</h3>
                <span className="text-secondary text-label-sm font-bold flex items-center gap-1">+12.5%</span>
              </div>
              <div className="mt-4 flex gap-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-primary rounded-full transition-all duration-500" style={{ width: stats.porcentajeMeta }}></div>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">Meta mensual: $60,000</p>
            </div>
          )}

          {/* Members Card - PARA AMBOS ROLES */}
          <div className={`${isAdmin ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-6'} bg-white p-6 border border-slate-200 rounded-2xl shadow-sm`}>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-secondary-container/20 p-3 rounded-xl">
                <span className="material-symbols-outlined text-secondary">group</span>
              </div>
              <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-1 rounded-full font-bold">Activo</span>
            </div>
            <p className="text-label-lg text-on-surface-variant mb-1">Total Movimientos</p>
            <h3 className="font-display text-on-surface text-2xl font-bold">{stats.miembrosTotales}</h3>
            <p className="mt-2 text-xs text-on-surface-variant">Actualizado hoy</p>
          </div>

          {/* Capacity Card - PARA AMBOS ROLES */}
          <div className={`${isAdmin ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-6'} bg-white p-6 border border-slate-200 rounded-2xl shadow-sm`}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-label-lg text-on-surface-variant">Ocupacion Actual</p>
              <span className="text-label-sm text-primary font-bold">{stats.ocupacionActual}%</span>
            </div>
            <div className="h-28 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocupation} barCategoryGap="20%">
                  <XAxis dataKey="hora" hide />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {ocupation.map((entry, index) => (
                      <rect key={`bar-${index}`} fill={entry.valor > 80 ? '#d60000' : entry.valor > 60 ? '#ff3b3b' : '#e6e6e6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
            </div>
          </div>

          {/* Afluencia Chart */}
          <div className="col-span-12 lg:col-span-8 bg-white p-4 md:p-8 border border-slate-200 rounded-2xl shadow-sm">
            <h4 className="font-title-lg text-on-surface mb-4">Afluencia en Tiempo Real</h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f8f9fa' }} />
                  <Bar dataKey="proyectado" fill="#e6e6e6" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="real" fill="#d60000" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sidebar - vencimientos */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-title-lg text-on-surface">Proximos Vencimientos</h4>
                <button className="text-primary text-xs font-bold cursor-pointer hover:underline">Ver todos</button>
              </div>
              <div className="space-y-4">
                {proximosVencimientos.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm">No hay vencimientos proximos</p>
                ) : (
                  proximosVencimientos.map((cliente) => (
                    <div key={cliente.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                      {cliente.fotoUrl ? (
                        <img src={cliente.fotoUrl} className="w-10 h-10 rounded-full object-cover" alt={cliente.nombre} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-primary font-bold">
                          {cliente.nombre?.charAt(0) || '?'}
                          {cliente.apellidos?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-label-lg font-bold">
                          {cliente.nombre} {cliente.apellidos}
                        </p>
                        <p className={`text-[10px] font-bold ${cliente.diasFaltantes <= 3 ? 'text-red-600' : 'text-orange-600'}`}>
                          {cliente.diasFaltantes < 0
                            ? `Vencio hace ${Math.abs(cliente.diasFaltantes)} dias`
                            : `Vence en ${cliente.diasFaltantes} dias`}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-[10px] font-black ${
                          cliente.diasFaltantes <= 3 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {cliente.diasFaltantes <= 3 ? 'URGENTE' : 'PENDIENTE'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Promo Card - SOLO PARA ADMIN */}
            {isAdmin && (
              <div className="bg-red-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h5 className="font-bold text-lg leading-tight mb-2">Campana de Verano</h5>
                  <p className="text-xs text-white/80 mb-4">Lanza la promocion 3x2 para renovaciones anticipadas.</p>
                  <button className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-xs hover:shadow-xl transition-shadow">
                    Activar Ahora
                  </button>
                </div>
                <div className="absolute -bottom-6 -right-6 text-white/10">
                  <span className="material-symbols-outlined text-[120px]">campaign</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Section */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-title-lg text-on-surface">Actividad de Recepcion</h4>
            <div className="flex gap-2">
              <span className="bg-primary text-white px-3 py-1 rounded-full text-xs font-bold">Todos</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {actividades.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No hay actividad reciente
              </div>
            ) : (
              actividades.map((act) => (
                <div key={act.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        act.tipo === 'check' ? 'bg-blue-50' : act.tipo === 'pago' ? 'bg-red-50' : 'bg-orange-100'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          act.tipo === 'check' ? 'text-blue-600' : act.tipo === 'pago' ? 'text-red-600' : 'text-orange-600'
                        }`}
                      >
                        {act.tipo === 'check' ? 'check_circle' : act.tipo === 'pago' ? 'credit_card' : 'person_add'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold   text-slate-800  dark:text-slate-200">
                        {act.usuario} - {act.accion}
                      </p>
                      <p className="text-xs text-slate-500">
                        {act.area} - {act.hora}
                      </p>
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="hidden md:block fixed bottom-8 right-8 z-50">
        <button className="w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>
    </main>
  );
};

export default Dashboard;

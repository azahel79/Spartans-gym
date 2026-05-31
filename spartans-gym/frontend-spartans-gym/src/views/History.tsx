import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHistoryStore } from '../store/history.store';
import { useAttendanceStore } from '../store/attendance.store';
import type { Attendance, PaymentMethod, Transaction, TransactionType } from '../types';
import { printAttendanceReceipt, printTransactionReceipt } from '../utils/receipts';

type HistoryView = 'planes' | 'pos' | 'asistencias';
type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

interface HistoryFilters {
  startDate: string;
  endDate: string;
  paymentMethod: PaymentMethod | 'Todos';
  category: string;
  searchTerm: string;
  status: string;
}

const toInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRange = (preset: DatePreset): Pick<HistoryFilters, 'startDate' | 'endDate'> => {
  const today = new Date();

  if (preset === 'all') return { startDate: '', endDate: '' };
  if (preset === 'today') return { startDate: toInputDate(today), endDate: '' };

  if (preset === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const value = toInputDate(yesterday);
    return { startDate: value, endDate: value };
  }

  if (preset === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { startDate: toInputDate(start), endDate: toInputDate(today) };
  }

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: toInputDate(startOfMonth), endDate: toInputDate(today) };
};

const initialFilters: HistoryFilters = {
  ...getDateRange('today'),
  paymentMethod: 'Todos',
  category: 'Cualquiera',
  searchTerm: '',
  status: 'Todos',
};

const getRelativeDate = (dateValue: string | null | undefined): string => {
  if (!dateValue) return 'Fecha desconocida';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays === 2) return 'Anteayer';

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDate = (dateValue: string | null | undefined): string => {
  if (!dateValue) return '--';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (fileName: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const History = () => {
  const [view, setView] = useState<HistoryView>('planes');
  const [filters, setFilters] = useState<HistoryFilters>(initialFilters);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { transactions, fetchTransactions, isLoading: isLoadingTransactions, error: transactionError } = useHistoryStore();
  const { attendances, fetchAttendances, isLoading: isLoadingAttendances, error: attendanceError } = useAttendanceStore();

  const transactionType: TransactionType | undefined = view === 'planes' ? 'MEMBRESIA' : view === 'pos' ? 'PRODUCTO' : undefined;

  useEffect(() => {
    fetchTransactions({
      tipo: transactionType,
      fechaInicio: filters.startDate || undefined,
      fechaFin: filters.endDate || undefined,
    });

    if (view === 'asistencias') {
      fetchAttendances({
        fechaInicio: filters.startDate || undefined,
        fechaFin: filters.endDate || undefined,
        status: filters.status,
        plan: filters.category,
        search: filters.searchTerm,
      });
    }
  }, [fetchAttendances, fetchTransactions, filters.category, filters.endDate, filters.searchTerm, filters.startDate, filters.status, transactionType, view]);

  const updateFilter = useCallback(<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setDatePreset('custom');
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    setFilters((prev) => ({
      ...prev,
      ...getDateRange(preset),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setDatePreset('today');
    setFilters(initialFilters);
  }, []);

  const filteredTransactions = useMemo(() => {
    if (view === 'asistencias') return [];

    const type: TransactionType = view === 'planes' ? 'MEMBRESIA' : 'PRODUCTO';

    return transactions.filter((transaction) => {
      if (transaction.tipo !== type) return false;
      if (filters.paymentMethod !== 'Todos' && transaction.metodo !== filters.paymentMethod) return false;

      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        const haystack = `${transaction.nombre} ${transaction.apellidos} ${transaction.concepto}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filters.category !== 'Cualquiera') {
        const concept = transaction.concepto.toLowerCase();
        const category = filters.category.toLowerCase();
        if (!concept.includes(category)) return false;
      }

      return true;
    });
  }, [filters, transactions, view]);

  const filteredAttendances = useMemo(() => {
    if (view !== 'asistencias') return [];

    return attendances.filter((attendance) => {
      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        const haystack = `${attendance.nombre} ${attendance.apellidos} ${attendance.telefono} ${attendance.clientId}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filters.status !== 'Todos' && attendance.status !== filters.status) return false;
      if (filters.category !== 'Cualquiera' && filters.category !== 'Todos los planes' && attendance.plan !== filters.category) return false;

      return true;
    });
  }, [attendances, filters, view]);

  const filteredData = useMemo<(Transaction | Attendance)[]>(() => {
    return view === 'asistencias' ? filteredAttendances : filteredTransactions;
  }, [filteredAttendances, filteredTransactions, view]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const isLoading = view === 'asistencias' ? isLoadingAttendances : isLoadingTransactions;
  const error = view === 'asistencias' ? attendanceError : transactionError;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, view]);

  const totalIngresosFiltrados = useMemo(() => {
    if (view === 'asistencias') return 0;
    return (filteredData as Transaction[]).reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
  }, [filteredData, view]);

  const getInitials = useCallback((nombre: string, apellidos: string) => {
    return `${nombre?.charAt(0) || ''}${apellidos?.charAt(0) || ''}`.toUpperCase();
  }, []);

  const getShortId = useCallback((id: string | number | null | undefined) => {
    if (!id) return 'Sin ID';
    const value = String(id);
    return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
  }, []);

  const handleViewChange = useCallback((newView: HistoryView) => {
    setView(newView);
    setDatePreset('today');
    setFilters(initialFilters);
  }, []);

  const handleExportCsv = useCallback(() => {
    const dateLabel = `${filters.startDate || 'todos'}_${filters.endDate || filters.startDate || 'todos'}`;

    if (view === 'asistencias') {
      downloadCsv(
        `historial_asistencias_${dateLabel}.csv`,
        ['ID asistencia', 'Fecha', 'Hora', 'Cliente ID', 'Nombre', 'Apellidos', 'Telefono', 'Plan', 'Estado'],
        (filteredData as Attendance[]).map((item) => [
          item.id,
          formatDate(item.fecha),
          item.hora,
          item.clientId,
          item.nombre,
          item.apellidos,
          item.telefono,
          item.plan,
          item.status,
        ])
      );
      return;
    }

    downloadCsv(
      `historial_${view === 'planes' ? 'planes' : 'punto_de_venta'}_${dateLabel}.csv`,
      ['ID', 'Fecha', 'Hora', 'Cliente ID', 'Nombre', 'Apellidos', 'Concepto', 'Metodo', 'Monto', 'Tipo'],
      (filteredData as Transaction[]).map((item) => [
        item.id,
        item.fecha,
        item.hora,
        item.clienteId || '',
        item.nombre,
        item.apellidos,
        item.concepto,
        item.metodo,
        item.monto,
        item.tipo,
      ])
    );
  }, [filteredData, filters.endDate, filters.startDate, view]);

  const renderMobileCard = (item: Transaction | Attendance) => {
    if (view === 'asistencias') {
      const attendance = item as Attendance;

      return (
        <article key={`${view}-${attendance.id}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{getRelativeDate(attendance.fecha)}</p>
              <p className="mt-1 text-xl font-black text-slate-900">{attendance.hora}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                attendance.status === 'ACTIVO' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {attendance.status}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
              {getInitials(attendance.nombre, attendance.apellidos)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {attendance.nombre} {attendance.apellidos}
              </p>
              <p className="mt-0.5 text-[11px] font-bold uppercase text-slate-400">ID: {getShortId(attendance.clientId)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{attendance.plan}</span>
            {attendance.telefono && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{attendance.telefono}</span>}
            <button onClick={() => printAttendanceReceipt(attendance)} className="ml-auto rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
              Comprobante
            </button>
          </div>
        </article>
      );
    }

    const transaction = item as Transaction;

    return (
      <article key={`${view}-${transaction.id}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{transaction.fecha}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{transaction.hora}</p>
          </div>
          <p className="shrink-0 text-lg font-black text-slate-900">${Number(transaction.monto || 0).toFixed(2)}</p>
        </div>

        {view !== 'pos' && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
              {getInitials(transaction.nombre, transaction.apellidos)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {transaction.nombre} {transaction.apellidos}
              </p>
              <p className="mt-0.5 text-[11px] font-bold uppercase text-slate-400">ID: {getShortId(transaction.clienteId || transaction.id)}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${view === 'pos' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
            {transaction.concepto || 'Venta'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <span className="material-symbols-outlined text-[14px]">{transaction.metodo === 'Tarjeta' ? 'credit_card' : 'payments'}</span>
            {transaction.metodo}
          </span>
          <button onClick={() => printTransactionReceipt(transaction)} className="ml-auto rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
            Recibo
          </button>
        </div>
      </article>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className="flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 border-t border-slate-200">
        <div className="text-center text-sm text-slate-500 sm:text-left">
          Mostrando <span className="font-semibold text-slate-900">{paginatedData.length}</span> de{' '}
          <span className="font-semibold text-slate-900">{filteredData.length}</span> registros
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
              currentPage === 1
                ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>

          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg font-semibold text-sm transition-all ${
                currentPage === page ? 'bg-red-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all ${
              currentPage === totalPages
                ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="pt-16 min-h-screen bg-background">
      <div className="p-container-padding max-w-7xl mx-auto space-y-stack-lg">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <nav className="flex text-label-sm text-slate-500 mb-2 gap-2">
              <span>Panel</span>
              <span>/</span>
              <span className="text-red-600">
                Historial de {view === 'planes' ? 'Planes' : view === 'pos' ? 'Punto de Venta' : 'Asistencias'}
              </span>
            </nav>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h2 className="font-headline-lg text-headline-lg text-on-surface text-[32px] font-bold">Historial</h2>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 sm:ml-4 overflow-x-auto">
                <button
                  onClick={() => handleViewChange('planes')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === 'planes' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  PLANES
                </button>
                <button
                  onClick={() => handleViewChange('pos')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === 'pos' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  PUNTO DE VENTA
                </button>
                <button
                  onClick={() => handleViewChange('asistencias')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === 'asistencias' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  ASISTENCIAS
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-stack-sm">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant rounded-xl text-label-lg text-on-surface-variant hover:bg-surface-container-low transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined">file_download</span>
              Exportar CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-label-lg font-semibold shadow-sm hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined">add</span>
              {view === 'asistencias' ? 'Registrar Entrada' : 'Nueva Transaccion'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter bg-white p-4 sm:p-6 rounded-24 shadow-sm border border-slate-200">
          <div className="col-span-12 flex flex-wrap gap-2">
            {[
              ['today', 'Hoy'],
              ['yesterday', 'Ayer'],
              ['week', '7 dias'],
              ['month', 'Mes'],
              ['all', 'Todos'],
            ].map(([preset, label]) => (
              <button
                key={preset}
                onClick={() => applyDatePreset(preset as DatePreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === preset ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
            <label className="text-label-sm font-semibold text-slate-700">Rango de Fechas</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  calendar_today
                </span>
                <input
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                />
              </div>
              <span className="hidden text-slate-400 text-sm sm:inline">a</span>
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  calendar_today
                </span>
                <input
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {view !== 'asistencias' ? (
            <>
              <div className="col-span-6 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">Metodo de Pago</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none bg-white"
                  value={filters.paymentMethod}
                  onChange={(e) => updateFilter('paymentMethod', e.target.value as PaymentMethod | 'Todos')}
                >
                  <option value="Todos">Todos</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
              <div className="col-span-6 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">{view === 'planes' ? 'Tipo de Plan' : 'Categoria'}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none bg-white"
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                >
                  <option value="Cualquiera">Cualquiera</option>
                  {view === 'planes' ? (
                    <>
                      <option value="Mensual">Mensual</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                      <option value="Anual">Anual</option>
                    </>
                  ) : (
                    <>
                      <option value="Suplementos">Suplementos</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Merchandising">Merchandising</option>
                      <option value="Accesorios">Accesorios</option>
                    </>
                  )}
                </select>
              </div>
              <div className="col-span-12 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">Buscar</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none"
                    placeholder="Cliente o concepto..."
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-12 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">Buscar Socio</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none"
                    placeholder="Nombre o ID..."
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  />
                </div>
              </div>
              <div className="col-span-6 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">Estado</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none bg-white"
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="VENCIDO">Vencido</option>
                  <option value="PENDIENTE">Pendiente</option>
                </select>
              </div>
              <div className="col-span-6 lg:col-span-2 flex flex-col gap-2">
                <label className="text-label-sm font-semibold text-slate-700">Plan</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-body-md outline-none bg-white"
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                >
                  <option value="Todos los planes">Todos los planes</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>
            </>
          )}

          <div className="col-span-12 lg:col-span-2 flex items-end">
            <button
              onClick={clearFilters}
              className="w-full h-[42px] bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-24 shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-3 sm:grid-cols-2 xl:hidden">
            {isLoading ? (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center text-sm text-slate-400">Cargando historial...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-12 text-center text-sm font-semibold text-red-600">{error}</div>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((item) => renderMobileCard(item))
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center text-sm italic text-slate-400">
                No hay registros que coincidan con los filtros seleccionados.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">
                    {view === 'asistencias' ? 'Hora de Entrada' : 'Fecha y Hora'}
                  </th>
                  {view !== 'pos' && (
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm">
                      {view === 'asistencias' ? 'Miembro' : 'Miembro / Cliente'}
                    </th>
                  )}
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">
                    {view === 'asistencias' ? 'Plan Activo' : view === 'pos' ? 'Producto / Concepto' : 'Concepto'}
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">{view === 'asistencias' ? 'Estado' : 'Metodo'}</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">
                    {view === 'asistencias' ? 'Acciones' : 'Monto'}
                  </th>
                  {view !== 'asistencias' && <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-center">Ticket</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-sm italic">
                      Cargando historial...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-red-600 text-sm font-semibold">
                      {error}
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((item: any) => (
                    <tr key={`${view}-${item.id}`} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">
                            {view === 'asistencias' ? item.hora : item.fecha}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {view === 'asistencias' ? getRelativeDate(item.fecha) : item.hora}
                          </span>
                        </div>
                      </td>
                      {view !== 'pos' && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                view === 'asistencias' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {getInitials(item.nombre, item.apellidos)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-800">
                                {item.nombre} {item.apellidos}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                ID: {item.clienteId || item.clientId || item.id}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            view === 'pos'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : view === 'asistencias'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {view === 'asistencias' ? item.plan : item.concepto || 'Venta'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {view === 'asistencias' ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              item.status === 'ACTIVO' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="material-symbols-outlined text-[16px]">
                              {item.metodo === 'Tarjeta' ? 'credit_card' : 'payments'}
                            </span>
                            <span className="text-sm">{item.metodo}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {view === 'asistencias' ? (
                          <button onClick={() => printAttendanceReceipt(item as Attendance)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Imprimir comprobante">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        ) : (
                          <span className="text-sm font-bold text-slate-900">${Number(item.monto || 0).toFixed(2)}</span>
                        )}
                      </td>
                      {view !== 'asistencias' && (
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => printTransactionReceipt(item as Transaction)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Imprimir recibo">
                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-sm italic">
                      No hay registros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {renderPagination()}

          <div className="bg-red-600 p-4 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-12">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-red-200 font-bold mb-1">
                    {view === 'asistencias' ? 'Entradas' : view === 'planes' ? 'Membresias' : 'Ventas'} (Filtradas)
                  </span>
                  <span className="text-3xl font-bold leading-none">{filteredData.length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-red-200 font-bold mb-1">Total cargado</span>
                  <span className="text-3xl font-bold leading-none">
                    {view === 'asistencias' ? attendances.length : transactions.length}
                  </span>
                </div>
              </div>
              {view !== 'asistencias' && (
                <div className="flex w-full min-w-0 items-center gap-4 rounded-2xl border border-red-500/30 bg-red-800/40 p-4 sm:w-auto sm:gap-6 sm:p-6">
                  <div className="shrink-0 rounded-xl bg-red-500/30 p-3">
                    <span className="material-symbols-outlined text-3xl sm:text-4xl">account_balance_wallet</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-100">Ingresos del Filtro</p>
                    <h3 className="break-words text-3xl font-black text-white sm:text-4xl">
                      ${totalIngresosFiltrados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default History;

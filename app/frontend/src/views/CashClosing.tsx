import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { isAdminRole, useAuthStore } from '../store/auth.store';
import { useCashShiftStore } from '../store/cashShift.store';
import type { CashShift, CashShiftReport, CashShiftType } from '../types';
import { getApiError } from '../utils/apiError';

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value || 0));
const shiftName = (type: CashShiftType) => type === 'MORNING' ? 'Turno matutino' : 'Turno vespertino / nocturno';

export const CashClosing = () => {
  const { user } = useAuthStore();
  const {
    currentShift, report, history, suggestedShiftType, isLoading, error,
    fetchCurrentShift, fetchReport, fetchHistory, openShift, closeShift, downloadCsv,
  } = useCashShiftStore();
  const [shiftType, setShiftType] = useState<CashShiftType | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [declaredCash, setDeclaredCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [lastClosed, setLastClosed] = useState<CashShift | null>(null);
  const [historyDate, setHistoryDate] = useState('');

  useEffect(() => {
    void Promise.all([fetchCurrentShift(), fetchHistory()]);
  }, [fetchCurrentShift, fetchHistory]);

  useEffect(() => {
    if (!currentShift) return;
    const timer = window.setInterval(() => void fetchReport(), 30_000);
    return () => window.clearInterval(timer);
  }, [currentShift, fetchReport]);

  const expectedCash = report?.summary.expectedCash || 0;
  const declared = Number(declaredCash || 0);
  const difference = Number((declared - expectedCash).toFixed(2));
  const visibleHistory = useMemo(
    () => historyDate ? history.filter((shift) => shift.dayKey === historyDate) : history,
    [history, historyDate]
  );

  const handleOpen = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) return void toast.error('El fondo inicial no puede ser negativo');
    try {
      await openShift({
        shiftType: shiftType || suggestedShiftType,
        openingCash: amount,
        openingNotes: openingNotes.trim() || undefined,
      });
      toast.success('Turno de caja abierto');
    } catch (caught) {
      toast.error(getApiError(caught, 'No se pudo abrir el turno'));
    }
  };

  const handleClose = async (event: React.FormEvent) => {
    event.preventDefault();
    if (declaredCash.trim() === '' || !Number.isFinite(declared) || declared < 0) {
      return void toast.error('Captura el efectivo contado en caja');
    }
    try {
      const closed = await closeShift({ declaredCash: declared, closingNotes: closingNotes.trim() || undefined });
      setLastClosed(closed);
      setDeclaredCash('');
      setClosingNotes('');
      toast.success('Corte de caja realizado correctamente');
    } catch (caught) {
      toast.error(getApiError(caught, 'No se pudo realizar el corte'));
    }
  };

  return (
    <main className="min-h-screen bg-background pb-24 pt-20 md:pb-8 md:pt-24">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-0">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Recepción / Caja</p>
            <h1 className="text-3xl font-black text-on-surface">Corte de Caja</h1>
            <p className="mt-1 text-on-surface-variant">Turno de {user?.email || 'recepción'} · ventas, membresías y asistencias.</p>
          </div>
          {currentShift && (
            <button onClick={() => void fetchReport()} className="rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-bold">
              <span className="material-symbols-outlined mr-2 align-middle text-lg">refresh</span>Actualizar reporte
            </button>
          )}
        </header>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {!currentShift ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <form onSubmit={handleOpen} className="rounded-[var(--radius-24)] border border-outline-variant bg-white p-6 shadow-sm sm:p-8">
              <div className="brand-soft mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
                <span className="material-symbols-outlined text-3xl">point_of_sale</span>
              </div>
              <h2 className="text-2xl font-black text-on-surface">Abrir turno de caja</h2>
              <p className="mb-6 mt-1 text-sm text-on-surface-variant">Abre tu turno antes de registrar ventas, clientes nuevos o renovaciones.</p>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold">Turno</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['MORNING', 'EVENING'] as CashShiftType[]).map((type) => (
                      <button type="button" key={type} onClick={() => setShiftType(type)}
                        className={`rounded-xl border p-4 text-left ${(shiftType || suggestedShiftType) === type ? 'brand-soft brand-border' : 'border-outline-variant'}`}>
                        <span className="material-symbols-outlined">{type === 'MORNING' ? 'light_mode' : 'dark_mode'}</span>
                        <p className="mt-2 font-bold">{type === 'MORNING' ? 'Mañana' : 'Tarde / Noche'}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-bold">Fondo inicial en efectivo
                  <input type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant p-3 text-lg font-black" />
                </label>
                <label className="block text-sm font-bold">Notas de apertura
                  <textarea maxLength={500} value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)}
                    placeholder="Ej. Se reciben $500 en cambio." className="mt-2 min-h-24 w-full rounded-xl border border-outline-variant p-3" />
                </label>
                <button disabled={isLoading} className="brand-bg brand-shadow brand-hover w-full rounded-xl py-4 font-black text-white disabled:opacity-50">
                  {isLoading ? 'Abriendo...' : 'Abrir turno'}
                </button>
              </div>
            </form>
            <div className="brand-summary-card rounded-[var(--radius-24)] p-7 text-white shadow-xl">
              <span className="material-symbols-outlined text-5xl">verified_user</span>
              <h3 className="mt-5 text-2xl font-black">Un corte por recepcionista</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">El turno matutino y el vespertino generan reportes independientes asociados al usuario que inició sesión.</p>
              <div className="mt-7 space-y-3 text-sm">
                {['Punto de venta', 'Clientes nuevos', 'Renovaciones', 'Asistencias', 'Totales por método de pago', 'Diferencia de efectivo'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                    <span className="material-symbols-outlined text-lg">check_circle</span>{item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="brand-summary-card rounded-[var(--radius-24)] p-6 text-white shadow-xl sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider">Turno abierto</span>
                  <h2 className="mt-3 text-2xl font-black">{shiftName(currentShift.shiftType)}</h2>
                  <p className="text-sm text-white/75">Abierto: {new Date(currentShift.openedAt).toLocaleString('es-MX')}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 text-right">
                  <p className="text-xs uppercase text-white/70">Fondo inicial</p>
                  <p className="text-2xl font-black">{money(currentShift.openingCash)}</p>
                </div>
              </div>
            </div>

            {report && <ReportSummary report={report} />}

            <form onSubmit={handleClose} className="cash-close-form grid gap-6 rounded-[var(--radius-24)] border border-outline-variant bg-white p-6 shadow-sm lg:grid-cols-[1fr_0.9fr] sm:p-8">
              <div>
                <h3 className="text-xl font-black">Conteo y cierre</h3>
                <p className="mb-5 mt-1 text-sm text-on-surface-variant">Cuenta únicamente el efectivo físico existente en caja.</p>
                <label className="block text-sm font-bold">Efectivo contado
                  <input type="number" min="0" step="0.01" value={declaredCash} onChange={(event) => setDeclaredCash(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant p-4 text-2xl font-black" placeholder="0.00" />
                </label>
                <label className="mt-4 block text-sm font-bold">Notas de cierre
                  <textarea maxLength={500} value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-xl border border-outline-variant p-3" placeholder="Observaciones, faltantes, sobrantes..." />
                </label>
              </div>
              <div className="cash-close-totals rounded-2xl bg-slate-50 p-5">
                <ValueLine label="Efectivo esperado" value={money(expectedCash)} />
                <ValueLine label="Efectivo declarado" value={money(declared)} />
                <div className={`cash-close-difference mt-4 rounded-xl p-4 ${difference === 0 ? 'cash-close-ok bg-emerald-50 text-emerald-700' : difference > 0 ? 'cash-close-extra bg-blue-50 text-blue-700' : 'cash-close-missing bg-red-50 text-red-700'}`}>
                  <p className="text-xs font-black uppercase">Diferencia</p>
                  <p className="text-3xl font-black">{money(difference)}</p>
                  <p className="mt-1 text-xs">{difference === 0 ? 'Caja cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante'}</p>
                </div>
                <button disabled={isLoading || declaredCash === ''} className="brand-bg brand-shadow brand-hover mt-5 w-full rounded-xl py-4 font-black text-white disabled:opacity-50">
                  {isLoading ? 'Cerrando...' : 'Realizar corte'}
                </button>
              </div>
            </form>
          </section>
        )}

        {lastClosed && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-black text-emerald-800">Corte guardado correctamente</p><p className="text-sm text-emerald-700">Diferencia: {money(lastClosed.difference)}</p></div>
            <button onClick={() => void downloadCsv(lastClosed)} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Descargar Excel</button>
          </div>
        )}

        <section className="mt-8 rounded-[var(--radius-24)] border border-outline-variant bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">Historial de cortes</h2><p className="text-sm text-on-surface-variant">{isAdminRole(user?.role) ? 'Todos los recepcionistas' : 'Tus cortes anteriores'}</p></div>
            <input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} className="rounded-xl border border-outline-variant px-3 py-2" />
          </div>
          <div className="grid gap-3">
            {visibleHistory.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No hay cortes registrados.</p> : visibleHistory.map((shift) => (
              <div key={shift.id} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div><p className="font-bold">{shiftName(shift.shiftType)} · {shift.dayKey}</p><p className="text-xs text-slate-500">{shift.user?.email || user?.email} · {shift.status === 'OPEN' ? 'Abierto' : 'Cerrado'}</p></div>
                <div className="text-sm sm:text-right"><p className="text-slate-500">Efectivo esperado</p><p className="font-black">{money(shift.expectedCash)}</p></div>
                {shift.status === 'CLOSED' && <button onClick={() => void downloadCsv(shift)} className="brand-soft rounded-xl px-4 py-2 text-sm font-bold"><span className="material-symbols-outlined mr-1 align-middle text-lg">download</span>Excel</button>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

function ReportSummary({ report }: { report: CashShiftReport }) {
  const cards = [
    ['payments', 'Ingresos', money(report.summary.totalIncome)],
    ['shopping_cart', 'Punto de venta', `${report.summary.productSalesCount} · ${money(report.summary.productSalesTotal)}`],
    ['person_add', 'Clientes nuevos', String(report.summary.newMembershipsCount)],
    ['autorenew', 'Renovaciones', String(report.summary.renewalsCount)],
    ['how_to_reg', 'Asistencias', String(report.summary.attendanceCount)],
    ['account_balance_wallet', 'Efectivo esperado', money(report.summary.expectedCash)],
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([icon, label, value]) => (
          <div key={label} className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
            <span className="brand-soft material-symbols-outlined mb-3 rounded-xl p-2">{icon}</span>
            <p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 rounded-2xl border border-outline-variant bg-white p-5 sm:grid-cols-3">
        <ValueLine label="Efectivo" value={money(report.paymentTotals.Efectivo)} />
        <ValueLine label="Tarjeta" value={money(report.paymentTotals.Tarjeta)} />
        <ValueLine label="Transferencia" value={money(report.paymentTotals.Transferencia)} />
      </div>
    </>
  );
}

function ValueLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-200 py-3 last:border-0"><span className="text-sm text-slate-500">{label}</span><strong>{value}</strong></div>;
}

import { CashShift, CashShiftType, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ValidationError } from '../utils/validation';
import { isAdminRole } from '../utils/roles';
import { mexicoDateKey } from './whatsapp.service';

export interface CashShiftReport {
  shift: {
    id: string;
    dayKey: string;
    shiftType: CashShiftType;
    receptionist: string;
    openedAt: string;
    closedAt: string | null;
    openingCash: number;
  };
  summary: {
    transactionCount: number;
    attendanceCount: number;
    productSalesCount: number;
    productSalesTotal: number;
    newMembershipsCount: number;
    renewalsCount: number;
    membershipTotal: number;
    totalIncome: number;
    expectedCash: number;
  };
  paymentTotals: Record<PaymentMethod, number>;
  transactions: Array<{
    id: number;
    date: string;
    time: string;
    category: 'PUNTO_DE_VENTA' | 'NUEVO_CLIENTE' | 'RENOVACION';
    client: string;
    concept: string;
    paymentMethod: PaymentMethod;
    amount: number;
  }>;
  attendances: Array<{
    id: number;
    date: string;
    time: string;
    clientId: string;
    client: string;
    phone: string;
    plan: string;
    status: string;
  }>;
}

export async function getOpenShift(userId: number) {
  return prisma.cashShift.findFirst({
    where: { userId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
}

export async function requireOpenCashShift(userId: number | undefined, role: string | undefined) {
  if (!userId) throw new ValidationError('Usuario no autenticado', undefined, 401);
  const shift = await getOpenShift(userId);
  if (!shift) {
    throw new ValidationError(
      isAdminRole(role)
        ? 'Debes abrir tu turno de caja antes de registrar actividad operativa'
        : 'Debes abrir tu turno de caja antes de registrar actividad',
      undefined,
      409
    );
  }
  if (shift.dayKey !== currentMexicoDayKey()) {
    throw new ValidationError('Tu turno abierto pertenece a otro día. Realiza el corte antes de registrar actividad nueva', undefined, 409);
  }
  return shift;
}

export async function buildCashShiftReport(
  shift: CashShift & { user?: { email: string } },
  endAt = new Date(),
  db: Pick<Prisma.TransactionClient, 'transaction' | 'attendance'> = prisma
): Promise<CashShiftReport> {
  const [transactions, attendances] = await Promise.all([
    db.transaction.findMany({
      where: {
        createdAt: { lte: endAt },
        OR: [
          { cashShiftId: shift.id },
          {
            cashShiftId: null,
            userId: shift.userId,
            createdAt: { gte: shift.openedAt, lte: endAt },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.attendance.findMany({
      where: {
        createdAt: { lte: endAt },
        OR: [
          { cashShiftId: shift.id },
          {
            cashShiftId: null,
            userId: shift.userId,
            createdAt: { gte: shift.openedAt, lte: endAt },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        client: {
          select: {
            nombre: true,
            apellidos: true,
            telefono: true,
            plan: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const paymentTotals: Record<PaymentMethod, number> = {
    Efectivo: 0,
    Tarjeta: 0,
    Transferencia: 0,
  };
  let productSalesCount = 0;
  let productSalesTotal = 0;
  let newMembershipsCount = 0;
  let renewalsCount = 0;
  let membershipTotal = 0;

  const transactionRows = transactions.map((transaction) => {
    const amount = Number(transaction.monto);
    paymentTotals[transaction.metodo] += amount;
    let category: CashShiftReport['transactions'][number]['category'];

    if (transaction.tipo === 'PRODUCTO') {
      category = 'PUNTO_DE_VENTA';
      productSalesCount += 1;
      productSalesTotal += amount;
    } else if (transaction.concepto.toLocaleLowerCase('es-MX').includes('renov')) {
      category = 'RENOVACION';
      renewalsCount += 1;
      membershipTotal += amount;
    } else {
      category = 'NUEVO_CLIENTE';
      newMembershipsCount += 1;
      membershipTotal += amount;
    }

    return {
      id: transaction.id,
      date: transaction.createdAt.toISOString(),
      time: transaction.hora,
      category,
      client: `${transaction.nombre} ${transaction.apellidos}`.trim(),
      concept: transaction.concepto,
      paymentMethod: transaction.metodo,
      amount,
    };
  });

  const openingCash = Number(shift.openingCash);
  const expectedCash = Number((openingCash + paymentTotals.Efectivo).toFixed(2));

  return {
    shift: {
      id: shift.id,
      dayKey: shift.dayKey,
      shiftType: shift.shiftType,
      receptionist: shift.user?.email || '',
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() || null,
      openingCash,
    },
    summary: {
      transactionCount: transactions.length,
      attendanceCount: attendances.length,
      productSalesCount,
      productSalesTotal: Number(productSalesTotal.toFixed(2)),
      newMembershipsCount,
      renewalsCount,
      membershipTotal: Number(membershipTotal.toFixed(2)),
      totalIncome: Number((productSalesTotal + membershipTotal).toFixed(2)),
      expectedCash,
    },
    paymentTotals: {
      Efectivo: Number(paymentTotals.Efectivo.toFixed(2)),
      Tarjeta: Number(paymentTotals.Tarjeta.toFixed(2)),
      Transferencia: Number(paymentTotals.Transferencia.toFixed(2)),
    },
    transactions: transactionRows,
    attendances: attendances.map((attendance) => ({
      id: attendance.id,
      date: attendance.createdAt.toISOString(),
      time: attendance.hora,
      clientId: attendance.clientId,
      client: `${attendance.client.nombre} ${attendance.client.apellidos}`.trim(),
      phone: attendance.client.telefono,
      plan: attendance.client.plan,
      status: attendance.client.status,
    })),
  };
}

export async function assertCashShiftOpen(
  tx: Prisma.TransactionClient,
  cashShiftId: string | undefined
) {
  if (!cashShiftId) return;
  const shift = await tx.cashShift.findFirst({
    where: { id: cashShiftId, status: 'OPEN' },
    select: { id: true, dayKey: true },
  });
  if (!shift || shift.dayKey !== currentMexicoDayKey()) {
    throw new ValidationError('El turno de caja ya fue cerrado o pertenece a otro día', undefined, 409);
  }
}

export function createCashShiftCsv(report: CashShiftReport, declaredCash?: number | null, difference?: number | null) {
  const escapeHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const money = (value: unknown) => Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const formatDateTime = (value: string | Date | null | undefined) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };
  const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };
  const categoryLabel = (category: CashShiftReport['transactions'][number]['category']) => {
    if (category === 'PUNTO_DE_VENTA') return 'Punto de venta';
    if (category === 'RENOVACION') return 'Renovación';
    return 'Nuevo cliente';
  };
  const renderRows = (rows: unknown[][]) => rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : '<tr><td class="empty" colspan="20">Sin registros para mostrar</td></tr>';
  const section = (title: string, headers: string[], rows: unknown[][]) => `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${renderRows(rows)}</tbody>
    </table>`;

  const shiftLabel = report.shift.shiftType === 'MORNING' ? 'Matutino' : 'Vespertino / Nocturno';
  const differenceValue = difference ?? null;
  const differenceStatus = differenceValue === null
    ? 'Sin cierre declarado'
    : differenceValue > 0
      ? 'Sobrante'
      : differenceValue < 0
        ? 'Faltante'
        : 'Cuadrado';
  const renewalTotal = report.transactions
    .filter((item) => item.category === 'RENOVACION')
    .reduce((sum, item) => sum + item.amount, 0);
  const newMembershipTotal = report.summary.membershipTotal - renewalTotal;
  const nonCashTotal = report.paymentTotals.Tarjeta + report.paymentTotals.Transferencia;

  const sections = [
    section('Datos del turno', ['Campo', 'Valor'], [
      ['ID del corte', report.shift.id],
      ['Fecha operativa', report.shift.dayKey],
      ['Turno', shiftLabel],
      ['Recepcionista', report.shift.receptionist || 'Sin usuario'],
      ['Apertura', formatDateTime(report.shift.openedAt)],
      ['Cierre', formatDateTime(report.shift.closedAt)],
    ]),
    section('Resumen ejecutivo', ['Indicador', 'Resultado'], [
      ['Ingresos totales', money(report.summary.totalIncome)],
      ['Total de membresías', money(report.summary.membershipTotal)],
      ['Total punto de venta', money(report.summary.productSalesTotal)],
      ['Movimientos registrados', report.summary.transactionCount],
      ['Asistencias registradas', report.summary.attendanceCount],
      ['Clientes nuevos', report.summary.newMembershipsCount],
      ['Renovaciones', report.summary.renewalsCount],
      ['Ventas de producto', report.summary.productSalesCount],
    ]),
    section('Control de efectivo', ['Campo', 'Monto / estado'], [
      ['Fondo inicial', money(report.shift.openingCash)],
      ['Efectivo cobrado', money(report.paymentTotals.Efectivo)],
      ['Efectivo esperado en caja', money(report.summary.expectedCash)],
      ['Efectivo declarado', declaredCash === null || declaredCash === undefined ? '' : money(declaredCash)],
      ['Diferencia', differenceValue === null ? '' : money(differenceValue)],
      ['Resultado de caja', differenceStatus],
    ]),
    section('Totales por método de pago', ['Método', 'Monto'], [
      ['Efectivo', money(report.paymentTotals.Efectivo)],
      ['Tarjeta', money(report.paymentTotals.Tarjeta)],
      ['Transferencia', money(report.paymentTotals.Transferencia)],
      ['Total no efectivo', money(nonCashTotal)],
      ['Total cobrado', money(report.summary.totalIncome)],
    ]),
    section('Desglose de ingresos', ['Concepto', 'Cantidad', 'Monto'], [
      ['Clientes nuevos', report.summary.newMembershipsCount, money(newMembershipTotal)],
      ['Renovaciones', report.summary.renewalsCount, money(renewalTotal)],
      ['Productos / punto de venta', report.summary.productSalesCount, money(report.summary.productSalesTotal)],
    ]),
    section('Detalle de movimientos', ['#', 'ID', 'Fecha', 'Hora registrada', 'Categoría', 'Cliente', 'Concepto', 'Método de pago', 'Monto'], [
      ...report.transactions.map((transaction, index) => [
        index + 1,
        transaction.id,
        formatDate(transaction.date),
        transaction.time,
        categoryLabel(transaction.category),
        transaction.client,
        transaction.concept,
        transaction.paymentMethod,
        money(transaction.amount),
      ]),
      ['TOTAL', '', '', '', '', '', '', '', money(report.summary.totalIncome)],
    ]),
    section('Registros de asistencia', ['#', 'ID asistencia', 'Fecha', 'Hora registrada', 'ID cliente', 'Cliente', 'Teléfono', 'Plan', 'Estado'], report.attendances.map((attendance, index) => [
      index + 1,
      attendance.id,
      formatDate(attendance.date),
      attendance.time,
      attendance.clientId,
      attendance.client,
      attendance.phone,
      attendance.plan,
      attendance.status,
    ])),
    section('Observaciones', ['Nota'], [
      ['Este archivo es un reporte operativo generado automáticamente por el sistema.'],
      ['Los montos están expresados en MXN.'],
    ]),
  ];

  return `\uFEFF<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { margin: 0 0 6px; color: #991b1b; font-size: 22px; font-weight: 700; }
    .meta { margin: 0 0 18px; color: #4b5563; font-size: 12px; }
    h2 { margin: 22px 0 8px; color: #111827; font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #dc2626; color: #ffffff; font-weight: 700; border: 1px solid #b91c1c; padding: 9px; text-align: left; }
    td { border: 1px solid #e5e7eb; padding: 8px; mso-number-format: "\\@"; }
    tr:nth-child(even) td { background: #f9fafb; }
    .empty { color: #6b7280; font-style: italic; text-align: center; }
  </style>
</head>
<body>
  <h1>MEXA GYM - Reporte de corte de caja</h1>
  <p class="meta"><strong>Generado:</strong> ${escapeHtml(formatDateTime(new Date()))}</p>
  ${sections.join('')}
</body>
</html>`;
}
export function getSuggestedShiftType(date = new Date()): CashShiftType {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    hour12: false,
  }).format(date));
  return hour < 14 ? 'MORNING' : 'EVENING';
}

export function currentMexicoDayKey() {
  return mexicoDateKey(new Date());
}

export function reportAsJson(report: CashShiftReport): Prisma.InputJsonValue {
  return report as unknown as Prisma.InputJsonValue;
}

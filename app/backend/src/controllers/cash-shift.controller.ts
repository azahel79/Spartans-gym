import { CashShiftStatus, CashShiftType, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import {
  buildCashShiftReport,
  createCashShiftCsv,
  currentMexicoDayKey,
  getOpenShift,
  getSuggestedShiftType,
  reportAsJson,
  type CashShiftReport,
} from '../services/cash-shift.service';
import { cleanString, parseEnum, parsePositiveNumber, ValidationError } from '../utils/validation';
import { auditLog } from '../services/audit-log.service';
import { isAdminRole } from '../utils/roles';

const SHIFT_TYPES = ['MORNING', 'EVENING'] as const;

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ success: false, error: 'Ya tienes un turno de caja abierto' });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getCurrentShift(req: Request, res: Response) {
  try {
    const shift = await getOpenShift(req.user!.id);
    if (!shift) {
      return res.json({
        success: true,
        data: null,
        suggestedShiftType: getSuggestedShiftType(),
      });
    }
    const report = await buildCashShiftReport(shift);
    return res.json({ success: true, data: { ...serializeShift(shift), report } });
  } catch (error) {
    return sendError(error, res, 'Error al consultar el turno');
  }
}

export async function openShift(req: Request, res: Response) {
  try {
    const openingCash = req.body.openingCash === undefined
      ? 0
      : parsePositiveNumber(req.body.openingCash, 'Fondo inicial', { allowZero: true, max: 1_000_000 });
    const shiftType = parseEnum(req.body.shiftType || getSuggestedShiftType(), 'Turno', SHIFT_TYPES) as CashShiftType;
    const openingNotes = req.body.openingNotes
      ? cleanString(req.body.openingNotes, 'Notas de apertura', { max: 500 })
      : null;

    if (await getOpenShift(req.user!.id)) throw new ValidationError('Ya tienes un turno de caja abierto', undefined, 409);

    const shift = await prisma.cashShift.create({
      data: {
        userId: req.user!.id,
        shiftType,
        dayKey: currentMexicoDayKey(),
        openingCash,
        openingNotes,
      },
      include: { user: { select: { email: true } } },
    });
    await auditLog({ req, action: 'CASH_SHIFT_OPENED', entity: 'CashShift', entityId: shift.id, summary: `Turno de caja abierto: ${shift.shiftType}`, metadata: { openingCash: Number(shift.openingCash), dayKey: shift.dayKey } });
    return res.status(201).json({ success: true, data: serializeShift(shift) });
  } catch (error) {
    return sendError(error, res, 'Error al abrir el turno');
  }
}

export async function previewCurrentShift(req: Request, res: Response) {
  try {
    const shift = await getOpenShift(req.user!.id);
    if (!shift) return res.status(404).json({ success: false, error: 'No tienes un turno abierto' });
    return res.json({ success: true, data: await buildCashShiftReport(shift) });
  } catch (error) {
    return sendError(error, res, 'Error al generar la vista previa');
  }
}

export async function closeCurrentShift(req: Request, res: Response) {
  try {
    const declaredCash = parsePositiveNumber(req.body.declaredCash, 'Efectivo declarado', {
      allowZero: true,
      max: 10_000_000,
    });
    const closingNotes = req.body.closingNotes
      ? cleanString(req.body.closingNotes, 'Notas de cierre', { max: 500 })
      : null;
    const shift = await getOpenShift(req.user!.id);
    if (!shift) return res.status(404).json({ success: false, error: 'No tienes un turno abierto' });

    const closedAt = new Date();

    const closedBase = await prisma.$transaction(async (tx) => {
      const locked = await tx.cashShift.updateMany({
        where: { id: shift.id, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt },
      });
      if (locked.count !== 1) {
        throw new ValidationError('El turno ya fue cerrado', undefined, 409);
      }

      return tx.cashShift.findUniqueOrThrow({
        where: { id: shift.id },
        include: { user: { select: { email: true, role: true } } },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 10_000,
    });

    const report = await buildCashShiftReport(closedBase, closedAt);
    const expectedCash = report.summary.expectedCash;
    const difference = Number((declaredCash - expectedCash).toFixed(2));
    const closed = await prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        expectedCash,
        declaredCash,
        difference,
        closingNotes,
        report: reportAsJson(report),
      },
      include: { user: { select: { email: true, role: true } } },
    });

    await auditLog({ req, action: 'CASH_SHIFT_CLOSED', entity: 'CashShift', entityId: closed.id, summary: `Turno de caja cerrado: diferencia ${difference}`, metadata: { expectedCash, declaredCash, difference, dayKey: closed.dayKey } });
    return res.json({
      success: true,
      data: { ...serializeShift(closed), report, expectedCash, declaredCash, difference },
    });
  } catch (error) {
    return sendError(error, res, 'Error al cerrar el turno');
  }
}
export async function listCashShifts(req: Request, res: Response) {
  try {
    const where: Prisma.CashShiftWhereInput = {};
    if (!isAdminRole(req.user?.role)) where.userId = req.user!.id;
    else if (req.query.userId) {
      const userId = Number(req.query.userId);
      if (!Number.isInteger(userId) || userId <= 0) throw new ValidationError('Usuario invÃ¡lido');
      where.userId = userId;
    }
    if (req.query.status) where.status = parseEnum(req.query.status, 'Estado', ['OPEN', 'CLOSED'] as const) as CashShiftStatus;
    if (req.query.dayKey) {
      const dayKey = String(req.query.dayKey);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new ValidationError('Fecha invÃ¡lida');
      where.dayKey = dayKey;
    }
    const shifts = await prisma.cashShift.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true, role: true } } },
    });
    return res.json({ success: true, data: shifts.map(serializeShift) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener los cortes');
  }
}

export async function getCashShiftById(req: Request, res: Response) {
  try {
    const shift = await prisma.cashShift.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true, role: true } } },
    });
    if (!shift) return res.status(404).json({ success: false, error: 'Corte no encontrado' });
    if (!isAdminRole(req.user?.role) && shift.userId !== req.user?.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para consultar este corte' });
    }
    const report = shift.report
      ? shift.report as unknown as CashShiftReport
      : await buildCashShiftReport(shift, shift.closedAt || new Date());
    return res.json({ success: true, data: { ...serializeShift(shift), report } });
  } catch (error) {
    return sendError(error, res, 'Error al obtener el corte');
  }
}

export async function downloadCashShiftCsv(req: Request, res: Response) {
  try {
    const shift = await prisma.cashShift.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true, role: true } } },
    });
    if (!shift) return res.status(404).json({ success: false, error: 'Corte no encontrado' });
    if (!isAdminRole(req.user?.role) && shift.userId !== req.user?.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para descargar este corte' });
    }
    const report = shift.report
      ? shift.report as unknown as CashShiftReport
      : await buildCashShiftReport(shift, shift.closedAt || new Date());
    const excel = createCashShiftCsv(
      report,
      shift.declaredCash === null ? null : Number(shift.declaredCash),
      shift.difference === null ? null : Number(shift.difference)
    );
    const filename = `reporte-corte-caja-${shift.dayKey}-${shift.shiftType.toLowerCase()}-${shift.user.email.split('@')[0]}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, '-')}"`);
    return res.send(excel);
  } catch (error) {
    return sendError(error, res, 'Error al generar el Excel');
  }
}

function serializeShift<T extends {
  openingCash: unknown;
  expectedCash: unknown;
  declaredCash: unknown;
  difference: unknown;
}>(shift: T) {
  return {
    ...shift,
    openingCash: Number(shift.openingCash),
    expectedCash: shift.expectedCash === null ? null : Number(shift.expectedCash),
    declaredCash: shift.declaredCash === null ? null : Number(shift.declaredCash),
    difference: shift.difference === null ? null : Number(shift.difference),
  };
}


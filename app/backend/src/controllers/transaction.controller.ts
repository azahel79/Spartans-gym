import { Request, Response } from 'express';
import { PaymentMethod, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { parseEnum, parseInteger, ValidationError } from '../utils/validation';
import { assertCashShiftOpen, requireOpenCashShift } from '../services/cash-shift.service';
import { auditLog } from '../services/audit-log.service';

const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia'] as const;
const TRANSACTION_TYPES = ['MEMBRESIA', 'PRODUCTO'] as const;

function getMexicoCityDateRange(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new ValidationError('La fecha debe usar el formato YYYY-MM-DD');
  const [year, month, day] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new ValidationError('Fecha inválida');
  }
  const mexicoCityOffsetHours = 6;
  return {
    startUTC: new Date(Date.UTC(year, month - 1, day, mexicoCityOffsetHours, 0, 0, 0)),
    endUTC: new Date(Date.UTC(year, month - 1, day + 1, mexicoCityOffsetHours, 0, 0, -1)),
  };
}

function sendControllerError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getTransactions(req: Request, res: Response) {
  try {
    const where: Prisma.TransactionWhereInput = {};
    if (req.query.tipo) where.tipo = parseEnum(req.query.tipo, 'Tipo', TRANSACTION_TYPES) as TransactionType;
    if (req.query.metodo) where.metodo = parseEnum(req.query.metodo, 'Método', PAYMENT_METHODS) as PaymentMethod;

    if (req.query.fechaInicio) {
      const { startUTC, endUTC } = getMexicoCityDateRange(String(req.query.fechaInicio));
      where.createdAt = { gte: startUTC, lte: endUTC };
    }
    if (req.query.fechaFin) {
      const { endUTC } = getMexicoCityDateRange(String(req.query.fechaFin));
      where.createdAt = { ...(where.createdAt as Prisma.DateTimeFilter), lte: endUTC };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    return res.json({
      success: true,
      data: transactions.map((transaction) => ({ ...transaction, monto: Number(transaction.monto) })),
    });
  } catch (error) {
    return sendControllerError(error, res, 'Error al obtener las transacciones');
  }
}

export async function getHistory(_req: Request, res: Response) {
  try {
    const transactions = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({
      success: true,
      data: transactions.map((transaction) => ({ ...transaction, monto: Number(transaction.monto) })),
    });
  } catch (error) {
    return sendControllerError(error, res, 'Error al obtener el historial');
  }
}

export async function createTransaction(req: Request, res: Response) {
  try {
    const cashShift = await requireOpenCashShift(req.user?.id, req.user?.role);
    const tipo = parseEnum(req.body.tipo, 'Tipo', TRANSACTION_TYPES) as TransactionType;
    const metodo = parseEnum(req.body.metodo, 'Método de pago', PAYMENT_METHODS) as PaymentMethod;
    if (tipo !== 'PRODUCTO') {
      throw new ValidationError('Las membresías deben registrarse desde inscripción o renovación');
    }
    if (!Array.isArray(req.body.productos) || req.body.productos.length === 0 || req.body.productos.length > 100) {
      throw new ValidationError('La venta debe incluir entre 1 y 100 productos');
    }

    const groupedItems = new Map<number, number>();
    for (const rawItem of req.body.productos) {
      if (!rawItem || typeof rawItem !== 'object') throw new ValidationError('Producto inválido');
      const id = parseInteger(rawItem.id, 'ID de producto', { min: 1 });
      const quantity = parseInteger(rawItem.quantity, 'Cantidad', { min: 1, max: 1000 });
      groupedItems.set(id, (groupedItems.get(id) || 0) + quantity);
    }
    const items = [...groupedItems.entries()].map(([id, quantity]) => ({ id, quantity }));

    const now = new Date();
    const transaction = await prisma.$transaction(async (tx) => {
      await assertCashShiftOpen(tx, cashShift?.id);
      const products = await tx.product.findMany({ where: { id: { in: items.map((item) => item.id) } } });
      if (products.length !== items.length) throw new ValidationError('Uno o más productos no existen');

      let total = 0;
      const concepts: string[] = [];
      for (const item of items) {
        const product = products.find((candidate) => candidate.id === item.id)!;
        if (product.stock < item.quantity) {
          throw new ValidationError(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
        }
        total += Number(product.price) * item.quantity;
        concepts.push(`${product.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`);
      }

      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: { id: item.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new ValidationError('El stock cambió durante la venta. Intenta nuevamente', undefined, 409);
      }

      return tx.transaction.create({
        data: {
          fecha: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }),
          hora: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }),
          nombre: 'Venta',
          apellidos: 'Mostrador',
          clienteId: null,
          concepto: concepts.join(', '),
          monto: Number(total.toFixed(2)),
          metodo,
          tipo,
          userId: req.user?.id,
          cashShiftId: cashShift?.id,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await auditLog({ req, action: 'PRODUCT_SALE_CREATED', entity: 'Transaction', entityId: transaction.id, summary: `Venta de productos: ${transaction.concepto}`, metadata: { amount: Number(transaction.monto), paymentMethod: transaction.metodo, cashShiftId: cashShift?.id } });
    return res.status(201).json({ success: true, data: { ...transaction, monto: Number(transaction.monto) } });
  } catch (error) {
    return sendControllerError(error, res, 'Error al crear la transacción');
  }
}

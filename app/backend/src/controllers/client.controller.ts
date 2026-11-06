import { Request, Response } from 'express';
import { ClientStatus, Genero, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { cleanString, parseEnum, parsePhone, parsePositiveNumber, ValidationError } from '../utils/validation';
import { enqueueWhatsAppNotification } from '../services/whatsapp.service';
import { promptRoutineLevelForClient } from '../services/routine-onboarding.service';
import { assertCashShiftOpen, requireOpenCashShift } from '../services/cash-shift.service';
import { auditLog } from '../services/audit-log.service';

const GENDERS = ['Masculino', 'Femenino', 'Otro'] as const;
const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia'] as const;
const CLIENT_STATUSES = ['ACTIVO', 'VENCIDO', 'PENDIENTE'] as const;

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

function getPlanMonths(planName: string, period?: string): number {
  const text = `${planName} ${period || ''}`.toLowerCase();
  const match = text.match(/(\d+)\s*(mes|meses|month|months)/);
  if (match) return Number(match[1]);
  if (text.includes('trimestral')) return 3;
  if (text.includes('semestral')) return 6;
  if (text.includes('anual') || text.includes('aÃ±o') || text.includes('ano') || text.includes('year')) return 12;
  return 1;
}

function calculateExpiryDate(baseDate: Date, plan: string, period?: string) {
  const expiry = new Date(baseDate);
  expiry.setMonth(expiry.getMonth() + getPlanMonths(plan, period));
  return expiry;
}

async function getActivePlanByName(planName: string) {
  const plan = await prisma.plan.findUnique({ where: { name: planName } });
  return plan?.isActive ? plan : null;
}

function paymentData(
  client: { id: string; nombre: string; apellidos: string },
  plan: string,
  amount: number,
  method: PaymentMethod,
  userId?: number,
  cashShiftId?: string,
  action = 'InscripciÃ³n'
) {
  const now = new Date();
  return {
    fecha: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }),
    hora: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }),
    nombre: client.nombre,
    apellidos: client.apellidos,
    clienteId: client.id,
    concepto: `${action} - Plan ${plan}`,
    monto: amount,
    metodo: method,
    tipo: 'MEMBRESIA' as const,
    userId,
    cashShiftId,
  };
}

export async function createClient(req: Request, res: Response) {
  try {
    const cashShift = await requireOpenCashShift(req.user?.id, req.user?.role);
    const nombre = cleanString(req.body.nombre, 'Nombre', { min: 2, max: 80 });
    const apellidos = cleanString(req.body.apellidos, 'Apellidos', { min: 2, max: 100 });
    const genero = parseEnum(req.body.genero, 'GÃ©nero', GENDERS) as Genero;
    const telefono = parsePhone(req.body.telefono);
    const planName = cleanString(req.body.plan, 'Plan', { min: 2, max: 100 });
    const method = parseEnum(req.body.metodoPago, 'MÃ©todo de pago', PAYMENT_METHODS) as PaymentMethod;
    const fotoUrl = req.body.fotoUrl ? cleanString(req.body.fotoUrl, 'Foto', { max: 2048 }) : null;
    if (req.body.whatsappOptIn !== undefined && typeof req.body.whatsappOptIn !== 'boolean') {
      throw new ValidationError('El consentimiento de WhatsApp debe ser booleano');
    }
    const whatsappOptIn = req.body.whatsappOptIn === true;

    const plan = await getActivePlanByName(planName);
    if (!plan) throw new ValidationError('Plan invÃ¡lido o inactivo');
    const price = Number(plan.price);
    if (req.body.monto !== undefined && Math.abs(parsePositiveNumber(req.body.monto, 'Monto') - price) > 0.009) {
      throw new ValidationError('El monto no coincide con el precio actual del plan');
    }

    const client = await prisma.$transaction(async (tx) => {
      await assertCashShiftOpen(tx, cashShift?.id);
      const created = await tx.client.create({
        data: {
          nombre,
          apellidos,
          genero,
          telefono,
          whatsappOptIn,
          plan: planName,
          monto: price,
          metodoPago: method,
          status: 'ACTIVO',
          ultimaVisita: '--:--',
          vencimiento: calculateExpiryDate(new Date(), planName, plan.period),
          fotoUrl,
        },
      });
      await tx.transaction.create({
        data: paymentData(created, planName, price, method, req.user?.id, cashShift?.id),
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    void enqueueWhatsAppNotification({ clientId: client.id, kind: 'WELCOME', referenceDate: client.vencimiento })
      .catch((error) => console.error('Error al preparar WhatsApp de bienvenida:', error));
    void promptRoutineLevelForClient(client.id)
      .catch((error) => console.error('Error al pedir nivel para rutina por WhatsApp:', error));
    await auditLog({ req, action: 'CLIENT_CREATED', entity: 'Client', entityId: client.id, summary: `Cliente creado: ${client.nombre} ${client.apellidos}`, metadata: { plan: client.plan, amount: Number(client.monto), paymentMethod: client.metodoPago } });
    return res.status(201).json({ success: true, data: { ...client, monto: Number(client.monto) } });
  } catch (error) {
    return sendError(error, res, 'Error al crear el cliente');
  }
}

export async function getClients(req: Request, res: Response) {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    await prisma.client.updateMany({
      where: { vencimiento: { lt: startOfToday }, status: 'ACTIVO' },
      data: { status: 'VENCIDO' },
    });
    const where: Prisma.ClientWhereInput = {};
    if (req.query.status) where.status = parseEnum(req.query.status, 'Estado', CLIENT_STATUSES) as ClientStatus;
    if (req.query.plan) where.plan = cleanString(req.query.plan, 'Plan', { max: 100 });
    if (req.query.search) {
      const search = cleanString(req.query.search, 'BÃºsqueda', { max: 100 });
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellidos: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } },
      ];
    }
    const clients = await prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 });
    return res.json({ success: true, data: clients.map((client) => ({ ...client, monto: Number(client.monto) })) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener los clientes');
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    return res.json({ success: true, data: { ...client, monto: Number(client.monto) } });
  } catch (error) {
    return sendError(error, res, 'Error al obtener el cliente');
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    if (!(await prisma.client.findUnique({ where: { id }, select: { id: true } }))) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    const data: Prisma.ClientUpdateInput = {};
    if (req.body.nombre !== undefined) data.nombre = cleanString(req.body.nombre, 'Nombre', { min: 2, max: 80 });
    if (req.body.apellidos !== undefined) data.apellidos = cleanString(req.body.apellidos, 'Apellidos', { min: 2, max: 100 });
    if (req.body.genero !== undefined) data.genero = parseEnum(req.body.genero, 'GÃ©nero', GENDERS) as Genero;
    if (req.body.telefono !== undefined) data.telefono = parsePhone(req.body.telefono);
    if (req.body.whatsappOptIn !== undefined) {
      if (typeof req.body.whatsappOptIn !== 'boolean') throw new ValidationError('El consentimiento de WhatsApp debe ser booleano');
      data.whatsappOptIn = req.body.whatsappOptIn;
    }
    if (req.body.metodoPago !== undefined) data.metodoPago = parseEnum(req.body.metodoPago, 'MÃ©todo', PAYMENT_METHODS) as PaymentMethod;
    if (req.body.fotoUrl !== undefined) data.fotoUrl = req.body.fotoUrl ? cleanString(req.body.fotoUrl, 'Foto', { max: 2048 }) : null;
    if (req.body.plan !== undefined) {
      const plan = cleanString(req.body.plan, 'Plan', { max: 100 });
      if (!(await getActivePlanByName(plan))) throw new ValidationError('Plan invÃ¡lido o inactivo');
      data.plan = plan;
    }
    if (Object.keys(data).length === 0) throw new ValidationError('No hay campos vÃ¡lidos para actualizar');
    const client = await prisma.client.update({ where: { id }, data });
    await auditLog({ req, action: 'CLIENT_UPDATED', entity: 'Client', entityId: client.id, summary: `Cliente actualizado: ${client.nombre} ${client.apellidos}`, metadata: { fields: Object.keys(data) } });
    return res.json({ success: true, data: { ...client, monto: Number(client.monto) } });
  } catch (error) {
    return sendError(error, res, 'Error al actualizar el cliente');
  }
}

export async function deleteClient(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    if (!(await prisma.client.findUnique({ where: { id }, select: { id: true } }))) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    const deleted = await prisma.client.delete({ where: { id } });
    await auditLog({ req, action: 'CLIENT_DELETED', entity: 'Client', entityId: id, summary: `Cliente eliminado: ${deleted.nombre} ${deleted.apellidos}` });
    return res.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (error) {
    return sendError(error, res, 'Error al eliminar el cliente');
  }
}

export async function registerAttendance(req: Request, res: Response) {
  try {
    const cashShift = await requireOpenCashShift(req.user?.id, req.user?.role);
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });

    const today = new Date();
    const expiry = new Date(client.vencimiento);
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    if (expiry < today) return res.status(403).json({ success: false, error: 'MembresÃ­a vencida' });

    const dayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const existing = await prisma.attendance.findUnique({ where: { clientId_dayKey: { clientId: id, dayKey } } });
    if (existing) return res.status(409).json({ success: false, error: 'El cliente ya registrÃ³ asistencia hoy' });

    const now = new Date();
    const hora = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' });
    const { updated, attendance } = await prisma.$transaction(async (tx) => {
      await assertCashShiftOpen(tx, cashShift?.id);
      const updated = await tx.client.update({
        where: { id },
        data: { ultimaVisita: hora, attendanceDate: now, status: 'ACTIVO' },
      });
      const attendance = await tx.attendance.create({
        data: {
          clientId: id,
          dayKey,
          ...(req.user?.id ? { userId: req.user.id } : {}),
          cashShiftId: cashShift?.id,
          fecha: now,
          hora,
        },
      });
      return { updated, attendance };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await auditLog({ req, action: 'ATTENDANCE_REGISTERED', entity: 'Attendance', entityId: attendance.id, summary: `Asistencia registrada: ${updated.nombre} ${updated.apellidos}`, metadata: { clientId: updated.id, cashShiftId: cashShift?.id } });
    return res.json({ success: true, data: { ultimaVisita: updated.ultimaVisita, attendanceDate: updated.attendanceDate, attendanceId: attendance.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'El cliente ya registrÃ³ asistencia hoy' });
    }
    return sendError(error, res, 'Error al registrar asistencia');
  }
}

export async function renewMembership(req: Request, res: Response) {
  try {
    const cashShift = await requireOpenCashShift(req.user?.id, req.user?.role);
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    const planName = cleanString(req.body.newPlan, 'Plan', { min: 2, max: 100 });
    const method = parseEnum(req.body.paymentMethod, 'MÃ©todo de pago', PAYMENT_METHODS) as PaymentMethod;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    const plan = await getActivePlanByName(planName);
    if (!plan) throw new ValidationError('Plan invÃ¡lido o inactivo');
    const price = Number(plan.price);
    if (req.body.amount !== undefined && Math.abs(parsePositiveNumber(req.body.amount, 'Monto') - price) > 0.009) {
      throw new ValidationError('El monto no coincide con el precio actual del plan');
    }

    const now = new Date();
    const currentExpiry = new Date(client.vencimiento);
    const newExpiry = calculateExpiryDate(currentExpiry > now ? currentExpiry : now, planName, plan.period);
    const updated = await prisma.$transaction(async (tx) => {
      await assertCashShiftOpen(tx, cashShift?.id);
      const result = await tx.client.update({
        where: { id },
        data: { plan: planName, monto: price, metodoPago: method, vencimiento: newExpiry, status: 'ACTIVO' },
      });
      await tx.transaction.create({
        data: paymentData(
          result,
          planName,
          price,
          method,
          req.user?.id,
          cashShift?.id,
          'RenovaciÃ³n de membresÃ­a'
        ),
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    void enqueueWhatsAppNotification({ clientId: updated.id, kind: 'RENEWAL', referenceDate: updated.vencimiento })
      .catch((error) => console.error('Error al preparar WhatsApp de renovación:', error));
    await auditLog({ req, action: 'MEMBERSHIP_RENEWED', entity: 'Client', entityId: updated.id, summary: `MembresÃ­a renovada: ${updated.nombre} ${updated.apellidos}`, metadata: { plan: updated.plan, amount: Number(updated.monto), paymentMethod: updated.metodoPago, cashShiftId: cashShift?.id } });
    return res.json({
      success: true,
      data: { plan: updated.plan, monto: Number(updated.monto), vencimiento: updated.vencimiento, status: updated.status },
    });
  } catch (error) {
    return sendError(error, res, 'Error al renovar membresÃ­a');
  }
}



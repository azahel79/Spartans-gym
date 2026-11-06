import { NotificationKind, NotificationStatus, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { scanMembershipNotifications } from '../services/membership-notification.service';
import { sendNotification, sendWhatsAppConnectionTest } from '../services/whatsapp.service';
import { getWhatsAppWebSessionStatus, restartWhatsAppWebSession } from '../services/whatsapp-webjs.service';
import { parseEnum, parseId, ValidationError } from '../utils/validation';

const STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
const KINDS = ['WELCOME', 'EXPIRY_REMINDER', 'EXPIRED', 'RENEWAL'] as const;

export async function getNotifications(req: Request, res: Response) {
  try {
    const where: Prisma.NotificationWhereInput = {};
    if (req.query.status) where.status = parseEnum(req.query.status, 'Estado', STATUSES) as NotificationStatus;
    if (req.query.kind) where.kind = parseEnum(req.query.kind, 'Tipo', KINDS) as NotificationKind;
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { client: { select: { nombre: true, apellidos: true, telefono: true } } },
    });
    return res.json({ success: true, data: notifications });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ success: false, error: error.message });
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener notificaciones' });
  }
}

export async function retryNotification(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ success: false, error: 'NotificaciÃ³n no encontrada' });
    await prisma.notification.update({ where: { id }, data: { status: 'PENDING', error: null } });
    await sendNotification(id);
    const updated = await prisma.notification.findUnique({ where: { id } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ success: false, error: error.message });
    console.error('Error al reintentar notificaciÃ³n:', error);
    return res.status(500).json({ success: false, error: 'Error al reintentar notificaciÃ³n' });
  }
}

export async function runNotificationScan(_req: Request, res: Response) {
  try {
    await scanMembershipNotifications();
    return res.json({ success: true, message: 'RevisiÃ³n de notificaciones completada' });
  } catch (error) {
    console.error('Error al revisar notificaciones:', error);
    return res.status(500).json({ success: false, error: 'Error al revisar notificaciones' });
  }
}

export async function testWhatsAppConnection(req: Request, res: Response) {
  try {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!phone) return res.status(400).json({ success: false, error: 'Ingresa el numero de WhatsApp para la prueba' });

    const result = await sendWhatsAppConnectionTest(phone);
    return res.json({
      success: true,
      message: 'Mensaje de prueba enviado correctamente',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al probar WhatsApp';
    console.error('Error al probar WhatsApp:', error);
    return res.status(400).json({ success: false, error: message });
  }
}
export async function getWhatsAppSession(_req: Request, res: Response) {
  try {
    return res.json({ success: true, data: getWhatsAppWebSessionStatus() });
  } catch (error) {
    console.error('Error al obtener sesión de WhatsApp:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener sesión de WhatsApp' });
  }
}

export async function restartWhatsAppSession(_req: Request, res: Response) {
  try {
    await restartWhatsAppWebSession();
    return res.json({ success: true, data: getWhatsAppWebSessionStatus() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al reiniciar sesión de WhatsApp';
    console.error('Error al reiniciar sesión de WhatsApp:', error);
    return res.status(400).json({ success: false, error: message });
  }
}



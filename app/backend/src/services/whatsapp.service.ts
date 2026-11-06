import { NotificationKind } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { sendWhatsAppWebMessage } from './whatsapp-webjs.service';

type TemplateParameter = { type: 'text'; text: string };

const WHATSAPP_REQUEST_TIMEOUT_MS = 8000;

async function fetchWhatsApp(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

const businessTemplateByKind: Record<NotificationKind, string> = {
  WELCOME: env.WHATSAPP_TEMPLATE_WELCOME,
  EXPIRY_REMINDER: env.WHATSAPP_TEMPLATE_EXPIRY_REMINDER,
  EXPIRED: env.WHATSAPP_TEMPLATE_EXPIRED,
  RENEWAL: env.WHATSAPP_TEMPLATE_RENEWAL,
};

const demoTemplateByKind: Record<NotificationKind, string> = {
  WELCOME: 'demo_bienvenida',
  EXPIRY_REMINDER: 'demo_recordatorio_vencimiento',
  EXPIRED: 'demo_membresia_vencida',
  RENEWAL: 'demo_renovacion',
};

function getTemplateName(kind: NotificationKind) {
  return env.WHATSAPP_PROVIDER === 'webjs' ? demoTemplateByKind[kind] : businessTemplateByKind[kind];
}

export function normalizeWhatsAppPhone(phone: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `${env.WHATSAPP_DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.startsWith('521') && digits.length === 13) digits = `52${digits.slice(3)}`;
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

export function formatMexicoDate(date: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function mexicoDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export async function enqueueWhatsAppNotification(input: {
  clientId: string;
  kind: NotificationKind;
  referenceDate?: Date;
  daysBefore?: number;
}) {
  if (!env.WHATSAPP_ENABLED) return null;

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, nombre: true, telefono: true, plan: true, vencimiento: true, whatsappOptIn: true },
  });
  if (!client?.whatsappOptIn) return null;
  const recipient = normalizeWhatsAppPhone(client.telefono);
  if (!recipient) return null;

  const referenceDate = input.referenceDate || client.vencimiento;
  const dedupeKey = [
    client.id,
    input.kind,
    mexicoDateKey(referenceDate),
    input.daysBefore ?? 'na',
  ].join(':');

  const notification = await prisma.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      clientId: client.id,
      kind: input.kind,
      dedupeKey,
      templateName: getTemplateName(input.kind),
      recipient,
      referenceDate,
      daysBefore: input.daysBefore,
    },
  });

  if (notification.status === 'PENDING' || notification.status === 'FAILED') {
    void sendNotification(notification.id);
  }
  return notification;
}

function buildDemoMessage(notification: Awaited<ReturnType<typeof getNotificationForSend>>) {
  if (!notification) return '';

  const name = notification.client.nombre;
  const plan = notification.client.plan;
  const expiry = formatMexicoDate(notification.referenceDate || notification.client.vencimiento);

  if (notification.kind === 'WELCOME') {
    return `Hola ${name}, bienvenido a MEXA GYM. Tu membresía ${plan} quedó activa y vence el ${expiry}. Gracias por entrenar con nosotros. Vamos con todo.`;
  }

  if (notification.kind === 'RENEWAL') {
    return `Hola ${name}, tu renovación del plan ${plan} quedó registrada correctamente. Tu nueva fecha de vencimiento es ${expiry}. Gracias por seguir con nosotros.`;
  }

  if (notification.kind === 'EXPIRY_REMINDER') {
    const days = notification.daysBefore || 0;
    return `Hola ${name}, te recordamos que tu membresía vence en ${days} día${days === 1 ? '' : 's'}, el ${expiry}. Te esperamos para renovar y seguir avanzando.`;
  }

  return `Hola ${name}, notamos que tu membresía venció el ${expiry}. Si algo te detuvo o necesitas apoyo para renovar, con gusto te ayudamos. Tu constancia también cuenta.`;
}

async function getNotificationForSend(notificationId: number) {
  return prisma.notification.findUnique({
    where: { id: notificationId },
    include: { client: { select: { nombre: true, apellidos: true, plan: true, vencimiento: true, whatsappOptIn: true } } },
  });
}

async function markAsFailed(notificationId: number, error: unknown) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      error: (error instanceof Error ? error.message : String(error || 'Error desconocido')).slice(0, 1000),
    },
  });
}

async function markAsSent(notificationId: number, providerId: string) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'SENT',
      providerId,
      sentAt: new Date(),
      error: null,
      attempts: { increment: 1 },
    },
  });
}

export async function sendNotification(notificationId: number) {
  const notification = await getNotificationForSend(notificationId);
  if (!notification || notification.status === 'SENT') return;

  if (!env.WHATSAPP_ENABLED || !notification.client.whatsappOptIn) {
    await prisma.notification.update({ where: { id: notificationId }, data: { status: 'SKIPPED', error: 'WhatsApp desactivado o sin consentimiento' } });
    return;
  }

  if (env.WHATSAPP_PROVIDER === 'webjs') {
    try {
      const providerId = await sendWhatsAppWebMessage(notification.recipient, buildDemoMessage(notification));
      await markAsSent(notificationId, providerId);
    } catch (error) {
      await markAsFailed(notificationId, error);
    }
    return;
  }

  // Proveedor oficial para producción futura: WhatsApp Business Cloud API.
  // Se conserva para activarlo cuando el proyecto ya contemple costo de Meta, hosting y token permanente.
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    await markAsFailed(notificationId, 'Faltan credenciales de WhatsApp Business');
    return;
  }

  const expiry = formatMexicoDate(notification.referenceDate || notification.client.vencimiento);
  const parameters: TemplateParameter[] =
    notification.kind === 'EXPIRY_REMINDER'
      ? [
          { type: 'text', text: notification.client.nombre },
          { type: 'text', text: String(notification.daysBefore || 0) },
          { type: 'text', text: expiry },
        ]
      : [
          { type: 'text', text: notification.client.nombre },
          { type: 'text', text: notification.client.plan },
          { type: 'text', text: expiry },
        ];

  try {
    const response = await fetchWhatsApp(
      `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: notification.recipient,
          type: 'template',
          template: {
            name: notification.templateName,
            language: { code: env.WHATSAPP_LANGUAGE_CODE },
            components: [{ type: 'body', parameters }],
          },
        }),
      }
    );
    const result = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!response.ok || !result.messages?.[0]?.id) {
      throw new Error(result.error?.message || `WhatsApp Business respondió ${response.status}`);
    }
    await markAsSent(notificationId, result.messages[0].id);
  } catch (error) {
    await markAsFailed(notificationId, error);
  }
}

export async function processPendingWhatsAppNotifications(limit = 50) {
  if (!env.WHATSAPP_ENABLED) return;
  const pending = await prisma.notification.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 5 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const notification of pending) await sendNotification(notification.id);
}

export async function sendWhatsAppConnectionTest(phone: string) {
  const recipient = normalizeWhatsAppPhone(phone);
  if (!recipient) throw new Error('Ingresa un número de WhatsApp válido');

  if (env.WHATSAPP_PROVIDER === 'webjs') {
    const providerId = await sendWhatsAppWebMessage(
      recipient,
      'Prueba demo de MEXA GYM: WhatsApp Web está conectado correctamente al sistema.'
    );
    return { recipient, providerId };
  }

  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('Faltan credenciales de WhatsApp Business');
  }

  const response = await fetchWhatsApp(
    `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      }),
    }
  );
  const result = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!response.ok || !result.messages?.[0]?.id) {
    throw new Error(result.error?.message || `WhatsApp Business respondió ${response.status}`);
  }

  return { recipient, providerId: result.messages[0].id };
}


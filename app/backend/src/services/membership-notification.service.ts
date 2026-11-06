import { env } from '../config/env';
import { prisma } from '../config/database';
import { enqueueWhatsAppNotification, mexicoDateKey, processPendingWhatsAppNotifications } from './whatsapp.service';


function logNotificationScanError(error: unknown) {
  const maybeError = error as { code?: string; meta?: { database_host?: string; database_port?: number } };
  if (maybeError?.code === 'P1001') {
    const host = maybeError.meta?.database_host || 'Supabase';
    const port = maybeError.meta?.database_port || 6543;
    console.error(`No se pudo revisar WhatsApp porque Supabase no respondió (${host}:${port}). Revisa internet/VPN o intenta de nuevo.`);
    return;
  }

  console.error('Error revisando notificaciones de WhatsApp:', error);
}
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export async function scanMembershipNotifications(now = new Date()) {
  if (!env.WHATSAPP_ENABLED) return;

  const clients = await prisma.client.findMany({
    where: { whatsappOptIn: true },
    select: { id: true, vencimiento: true },
  });
  const todayKey = mexicoDateKey(now);

  for (const client of clients) {
    const expiryKey = mexicoDateKey(client.vencimiento);
    if (expiryKey <= todayKey) {
      await prisma.client.updateMany({ where: { id: client.id, status: 'ACTIVO' }, data: { status: 'VENCIDO' } });
      await enqueueWhatsAppNotification({ clientId: client.id, kind: 'EXPIRED', referenceDate: client.vencimiento });
      continue;
    }
    for (const days of env.WHATSAPP_REMINDER_DAYS) {
      if (mexicoDateKey(addDays(now, days)) === expiryKey) {
        await enqueueWhatsAppNotification({
          clientId: client.id,
          kind: 'EXPIRY_REMINDER',
          referenceDate: client.vencimiento,
          daysBefore: days,
        });
      }
    }
  }
  await processPendingWhatsAppNotifications();
}

let timer: NodeJS.Timeout | null = null;

export function startMembershipNotificationScheduler() {
  if (!env.WHATSAPP_ENABLED || timer) return;
  void scanMembershipNotifications().catch((error) => logNotificationScanError(error));
  timer = setInterval(() => {
    void scanMembershipNotifications().catch((error) => logNotificationScanError(error));
  }, 60 * 60 * 1000);
  timer.unref();
}

export function stopMembershipNotificationScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}


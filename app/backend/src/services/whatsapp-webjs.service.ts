import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import { env } from '../config/env';

export type WhatsAppWebSessionStatus =
  | 'disabled'
  | 'idle'
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'ready'
  | 'disconnected'
  | 'failed';

let client: Client | null = null;
let isStarting = false;
let status: WhatsAppWebSessionStatus = env.WHATSAPP_ENABLED && env.WHATSAPP_PROVIDER === 'webjs' ? 'idle' : 'disabled';
let qrCodeDataUrl: string | null = null;
let lastError: string | null = null;
let connectedAt: Date | null = null;
let disconnectedAt: Date | null = null;
let sendQueue: Promise<unknown> = Promise.resolve();

export type WhatsAppIncomingMessage = {
  from: string;
  fromCandidates: string[];
  body: string;
  raw: Message;
};

type WhatsAppIncomingHandler = (message: WhatsAppIncomingMessage) => Promise<void> | void;

const incomingHandlers = new Set<WhatsAppIncomingHandler>();

function findBrowserPath() {
  const candidates = [
    env.WHATSAPP_WEBJS_BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function setStatus(nextStatus: WhatsAppWebSessionStatus, error?: unknown) {
  status = nextStatus;
  if (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverableWhatsAppWebError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /detached frame|execution context was destroyed|target closed|session closed|protocol error|no lid for user/i.test(message);
}

async function waitUntilReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (client && status === 'ready') return true;
    await sleep(500);
  }
  return Boolean(client && status === 'ready');
}

function getPhoneFromMessageId(value: string) {
  return value.split('@')[0]?.replace(/\D/g, '') || '';
}

async function handleIncomingMessage(message: Message) {
  if (message.fromMe || message.from === 'status@broadcast' || message.from.endsWith('@g.us')) return;

  const body = (message.body || '').trim();
  if (!body) return;

  const candidates = new Set<string>();
  candidates.add(getPhoneFromMessageId(message.from));
  if (message.author) candidates.add(getPhoneFromMessageId(message.author));

  try {
    const contact = await message.getContact();
    candidates.add(getPhoneFromMessageId(contact.id?._serialized || ''));
    candidates.add(getPhoneFromMessageId(contact.id?.user || ''));
    if (contact.number) candidates.add(contact.number.replace(/\D/g, ''));
  } catch (error) {
    console.warn('No se pudo resolver contacto entrante de WhatsApp:', error instanceof Error ? error.message : error);
  }

  const fromCandidates = [...candidates].filter(Boolean);
  const from = fromCandidates[0] || getPhoneFromMessageId(message.from);
  if (!from && fromCandidates.length === 0) return;

  for (const handler of incomingHandlers) {
    try {
      await handler({ from, fromCandidates, body, raw: message });
    } catch (error) {
      console.error('Error al procesar mensaje entrante de WhatsApp:', error);
    }
  }
}

export function registerWhatsAppWebMessageHandler(handler: WhatsAppIncomingHandler) {
  incomingHandlers.add(handler);
  return () => incomingHandlers.delete(handler);
}

export function isWhatsAppWebProvider() {
  return env.WHATSAPP_ENABLED && env.WHATSAPP_PROVIDER === 'webjs';
}

export function startWhatsAppWebSession() {
  if (!isWhatsAppWebProvider()) {
    setStatus('disabled');
    return;
  }
  if (client || isStarting) return;

  isStarting = true;
  setStatus('initializing');

  const executablePath = findBrowserPath();
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: env.WHATSAPP_WEBJS_CLIENT_ID,
      dataPath: path.resolve(process.cwd(), '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: env.WHATSAPP_WEBJS_HEADLESS,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', (qr) => {
    void QRCode.toDataURL(qr, { margin: 1, width: 320 })
      .then((dataUrl) => {
        qrCodeDataUrl = dataUrl;
        setStatus('qr');
      })
      .catch((error) => setStatus('failed', error));
  });

  client.on('authenticated', () => {
    qrCodeDataUrl = null;
    setStatus('authenticated');
  });

  client.on('ready', () => {
    qrCodeDataUrl = null;
    connectedAt = new Date();
    disconnectedAt = null;
    lastError = null;
    setStatus('ready');
  });

  client.on('message', (message) => {
    void handleIncomingMessage(message);
  });

  client.on('auth_failure', (message) => {
    setStatus('failed', message || 'No se pudo autenticar la sesión de WhatsApp Web');
  });

  client.on('disconnected', (reason) => {
    disconnectedAt = new Date();
    qrCodeDataUrl = null;
    client = null;
    setStatus('disconnected', reason || 'Sesión desconectada');
  });

  client.initialize()
    .catch((error) => {
      client = null;
      setStatus('failed', error);
    })
    .finally(() => {
      isStarting = false;
    });
}

export async function restartWhatsAppWebSession() {
  const current = client;
  client = null;
  qrCodeDataUrl = null;
  connectedAt = null;
  disconnectedAt = null;
  lastError = null;
  setStatus(isWhatsAppWebProvider() ? 'idle' : 'disabled');

  if (current) {
    try {
      await current.destroy();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  startWhatsAppWebSession();
}

export async function stopWhatsAppWebSession() {
  if (!client) return;
  const current = client;
  client = null;
  try {
    await current.destroy();
  } finally {
    setStatus('disconnected');
  }
}

export function getWhatsAppWebSessionStatus() {
  if (isWhatsAppWebProvider() && status === 'idle') startWhatsAppWebSession();

  return {
    provider: env.WHATSAPP_PROVIDER,
    enabled: env.WHATSAPP_ENABLED,
    status,
    qrCodeDataUrl,
    lastError,
    connectedAt: connectedAt?.toISOString() || null,
    disconnectedAt: disconnectedAt?.toISOString() || null,
    clientId: env.WHATSAPP_WEBJS_CLIENT_ID,
    headless: env.WHATSAPP_WEBJS_HEADLESS,
  };
}

async function resolveRecipientChatId(recipient: string) {
  if (!client) return null;
  let numberId = await client.getNumberId(recipient);
  if (!numberId?._serialized && recipient.startsWith('52') && recipient.length === 12) {
    numberId = await client.getNumberId(`521${recipient.slice(2)}`);
  }
  return numberId?._serialized || null;
}

async function ensureReadyForSend() {
  if (!isWhatsAppWebProvider()) throw new Error('El proveedor demo de WhatsApp Web está desactivado');
  if (!client || status !== 'ready') {
    startWhatsAppWebSession();
    throw new Error('WhatsApp Web aún no está conectado. Escanea el QR desde Configuración > Notificaciones.');
  }
}
async function sendWhatsAppWebMessageNow(recipient: string, message: string) {
  await ensureReadyForSend();

  try {
    const chatId = await resolveRecipientChatId(recipient);
    if (!chatId) {
      throw new Error(`El número ${recipient} no está registrado en WhatsApp o no puede resolverse desde esta sesión.`);
    }

    const sent = await client!.sendMessage(chatId, message);
    return sent.id?._serialized || sent.id?.id || `webjs:${Date.now()}`;
  } catch (error) {
    if (!isRecoverableWhatsAppWebError(error)) throw error;

    await restartWhatsAppWebSession();
    const recovered = await waitUntilReady();
    if (!recovered) {
      throw new Error('La sesión de WhatsApp Web se reinició porque estaba inestable. Espera a que diga Conectado o vuelve a escanear el QR.');
    }

    const chatId = await resolveRecipientChatId(recipient);
    if (!chatId) {
      throw new Error(`El número ${recipient} no está registrado en WhatsApp o no puede resolverse desde esta sesión.`);
    }

    const sent = await client!.sendMessage(chatId, message);
    return sent.id?._serialized || sent.id?.id || `webjs:${Date.now()}`;
  }
}
export async function sendWhatsAppWebMessage(recipient: string, message: string) {
  const run = sendQueue.then(() => sendWhatsAppWebMessageNow(recipient, message), () => sendWhatsAppWebMessageNow(recipient, message));
  sendQueue = run.catch(() => undefined);
  return run;
}








async function sendWhatsAppWebDocumentNow(recipient: string, filePath: string, caption?: string) {
  await ensureReadyForSend();

  try {
    const chatId = await resolveRecipientChatId(recipient);
    if (!chatId) {
      throw new Error(`El número ${recipient} no está registrado en WhatsApp o no puede resolverse desde esta sesión.`);
    }

    const media = MessageMedia.fromFilePath(filePath);
    const sent = await client!.sendMessage(chatId, media, { caption, sendMediaAsDocument: true });
    return sent.id?._serialized || sent.id?.id || `webjs-doc:${Date.now()}`;
  } catch (error) {
    if (!isRecoverableWhatsAppWebError(error)) throw error;

    await restartWhatsAppWebSession();
    const recovered = await waitUntilReady();
    if (!recovered) {
      throw new Error('La sesión de WhatsApp Web se reinició porque estaba inestable. Espera a que diga Conectado o vuelve a escanear el QR.');
    }

    const chatId = await resolveRecipientChatId(recipient);
    if (!chatId) {
      throw new Error(`El número ${recipient} no está registrado en WhatsApp o no puede resolverse desde esta sesión.`);
    }

    const media = MessageMedia.fromFilePath(filePath);
    const sent = await client!.sendMessage(chatId, media, { caption, sendMediaAsDocument: true });
    return sent.id?._serialized || sent.id?.id || `webjs-doc:${Date.now()}`;
  }
}

export async function sendWhatsAppWebDocument(recipient: string, filePath: string, caption?: string) {
  const run = sendQueue.then(() => sendWhatsAppWebDocumentNow(recipient, filePath, caption), () => sendWhatsAppWebDocumentNow(recipient, filePath, caption));
  sendQueue = run.catch(() => undefined);
  return run;
}


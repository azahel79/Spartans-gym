import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { cleanString, optionalUrl, parseEmail, parsePhone, ValidationError } from '../utils/validation';
import { auditLog } from '../services/audit-log.service';

const defaults = {
  name: 'MEXA GYM',
  email: 'contacto@mexagym.com',
  phone: '+52 55 1234 5678',
  address: 'México',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const allowedSidebarStyles = ['light', 'dark', 'brand'] as const;
const allowedAnimations = ['none', 'subtle', 'dynamic'] as const;
const allowedRadii = ['compact', 'rounded', 'soft'] as const;

function parseAppearance(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Apariencia inválida');
  const input = value as Record<string, unknown>;
  const color = (key: string, fallback: string) => {
    const current = input[key];
    if (current === undefined) return fallback;
    if (typeof current !== 'string' || !HEX_COLOR.test(current)) throw new ValidationError(`${key} debe ser un color hexadecimal`);
    return current.toLowerCase();
  };
  const optionalImage = (key: string) => input[key] === undefined ? null : optionalUrl(input[key], key);
  const sidebarStyle = typeof input.sidebarStyle === 'string' && allowedSidebarStyles.includes(input.sidebarStyle as typeof allowedSidebarStyles[number])
    ? input.sidebarStyle : 'light';
  const animation = typeof input.animation === 'string' && allowedAnimations.includes(input.animation as typeof allowedAnimations[number])
    ? input.animation : 'subtle';
  const radius = typeof input.radius === 'string' && allowedRadii.includes(input.radius as typeof allowedRadii[number])
    ? input.radius : 'rounded';
  return {
    primaryColor: color('primaryColor', '#d60000'),
    secondaryColor: color('secondaryColor', '#2b2b2b'),
    accentColor: color('accentColor', '#ff3b30'),
    backgroundColor: color('backgroundColor', '#f7f7f7'),
    sidebarStyle,
    animation,
    radius,
    loginBackground: optionalImage('loginBackground'),
    sidebarBackground: optionalImage('sidebarBackground'),
    loginHeadline: cleanString(input.loginHeadline ?? 'Gestión inteligente para tu gimnasio', 'Título de login', { min: 2, max: 100 }),
    loginSubtitle: cleanString(input.loginSubtitle ?? 'Administra miembros, ventas y asistencias en un solo lugar.', 'Subtítulo de login', { min: 2, max: 180 }),
    showLoginOverlay: input.showLoginOverlay !== false,
  };
}

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getGymConfig(_req: Request, res: Response) {
  try {
    const config = (await prisma.gymConfig.findFirst()) || (await prisma.gymConfig.create({ data: defaults }));
    return res.json({ success: true, data: config });
  } catch (error) {
    return sendError(error, res, 'Error al obtener configuración');
  }
}

export async function updateGymConfig(req: Request, res: Response) {
  try {
    const current = await prisma.gymConfig.findFirst();
    const data: Prisma.GymConfigUpdateInput = {};
    if (req.body.name !== undefined) data.name = cleanString(req.body.name, 'Nombre', { min: 2, max: 120 });
    if (req.body.email !== undefined) data.email = parseEmail(req.body.email);
    if (req.body.phone !== undefined) data.phone = parsePhone(req.body.phone);
    if (req.body.address !== undefined) data.address = cleanString(req.body.address, 'Dirección', { min: 3, max: 250 });
    if (req.body.logo !== undefined) data.logo = optionalUrl(req.body.logo, 'Logo');
    if (req.body.appearance !== undefined) data.appearance = parseAppearance(req.body.appearance);
    if (Object.keys(data).length === 0) throw new ValidationError('No hay campos válidos para actualizar');

    const config = current
      ? await prisma.gymConfig.update({ where: { id: current.id }, data })
      : await prisma.gymConfig.create({ data: { ...defaults, ...(data as Prisma.GymConfigCreateInput) } });
    await auditLog({ req, action: 'GYM_CONFIG_UPDATED', entity: 'GymConfig', entityId: config.id, summary: 'Configuración del gimnasio actualizada', metadata: { fields: Object.keys(data) } });
    return res.json({ success: true, data: config });
  } catch (error) {
    return sendError(error, res, 'Error al actualizar configuración');
  }
}

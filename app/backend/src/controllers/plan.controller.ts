import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { cleanString, parsePositiveNumber, ValidationError } from '../utils/validation';

function serialize<T extends { price: unknown }>(plan: T) {
  return { ...plan, price: Number(plan.price) };
}
function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getPlans(_req: Request, res: Response) {
  try {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } });
    return res.json({ success: true, data: plans.map(serialize) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener planes');
  }
}

export async function getPlanById(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    return res.json({ success: true, data: serialize(plan) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener plan');
  }
}

export async function createPlan(req: Request, res: Response) {
  try {
    const name = cleanString(req.body.name, 'Nombre', { min: 2, max: 100 });
    const price = parsePositiveNumber(req.body.price, 'Precio', { max: 1_000_000 });
    const period = cleanString(req.body.period || 'Mes', 'Periodo', { min: 2, max: 50 });
    const color = cleanString(req.body.color || 'bg-primary', 'Color', { min: 2, max: 80 });
    const plan = await prisma.plan.create({ data: { name, price, period, color, isActive: true } });
    return res.status(201).json({ success: true, data: serialize(plan) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ success: false, error: 'Ya existe un plan con ese nombre' });
    return sendError(error, res, 'Error al crear plan');
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    if (!(await prisma.plan.findUnique({ where: { id }, select: { id: true } }))) {
      return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    }
    const data: Prisma.PlanUpdateInput = {};
    if (req.body.name !== undefined) data.name = cleanString(req.body.name, 'Nombre', { min: 2, max: 100 });
    if (req.body.price !== undefined) data.price = parsePositiveNumber(req.body.price, 'Precio', { max: 1_000_000 });
    if (req.body.period !== undefined) data.period = cleanString(req.body.period, 'Periodo', { min: 2, max: 50 });
    if (req.body.color !== undefined) data.color = cleanString(req.body.color, 'Color', { min: 2, max: 80 });
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') throw new ValidationError('isActive debe ser booleano');
      data.isActive = req.body.isActive;
    }
    if (Object.keys(data).length === 0) throw new ValidationError('No hay campos válidos para actualizar');
    const plan = await prisma.plan.update({ where: { id }, data });
    return res.json({ success: true, data: serialize(plan) });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ success: false, error: 'Ya existe un plan con ese nombre' });
    return sendError(error, res, 'Error al actualizar plan');
  }
}

export async function deletePlan(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'ID', { max: 100 });
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ success: false, error: 'Plan no encontrado' });
    await prisma.plan.update({ where: { id }, data: { isActive: false } });
    return res.json({ success: true, message: 'Plan desactivado correctamente' });
  } catch (error) {
    return sendError(error, res, 'Error al eliminar plan');
  }
}

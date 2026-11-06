import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { hashPassword } from '../services/password.service';
import { parseEmail, parseEnum, parseId, validatePassword, ValidationError } from '../utils/validation';
import { auditLog } from '../services/audit-log.service';
import { isSuperAdminRole, MANAGED_USER_ROLES } from '../utils/roles';

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getUsers(_req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: 'superadmin' } },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: users });
  } catch (error) {
    return sendError(error, res, 'Error al obtener usuarios');
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const email = parseEmail(req.body.email);
    const password = validatePassword(req.body.password);
    const role = parseEnum(req.body.role || 'recepcionista', 'Rol', MANAGED_USER_ROLES) as Role;
    const user = await prisma.user.create({
      data: { email, password: await hashPassword(password), role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    await auditLog({ req, action: 'USER_CREATED', entity: 'User', entityId: user.id, summary: `Usuario creado: ${user.email}`, metadata: { role: user.role } });
    return res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ success: false, error: 'Ya existe un usuario con ese email' });
    return sendError(error, res, 'Error al crear usuario');
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const role = parseEnum(req.body.role, 'Rol', MANAGED_USER_ROLES) as Role;
    if (id === req.user?.id) throw new ValidationError('No puedes cambiar el rol de tu propia cuenta');
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (isSuperAdminRole(target.role)) {
      throw new ValidationError('No puedes modificar una cuenta superadmin desde esta pantalla', undefined, 403);
    }
    if (target.role === 'admin' && role !== 'admin' && (await prisma.user.count({ where: { role: 'admin' } })) <= 1) {
      throw new ValidationError('Debe existir al menos un administrador');
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    await auditLog({ req, action: 'USER_ROLE_UPDATED', entity: 'User', entityId: user.id, summary: `Rol actualizado: ${user.email} -> ${user.role}`, metadata: { role: user.role } });
    return res.json({ success: true, data: user });
  } catch (error) {
    return sendError(error, res, 'Error al actualizar rol');
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (id === req.user?.id) throw new ValidationError('No puedes eliminar tu propia cuenta');
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    if (isSuperAdminRole(target.role)) {
      throw new ValidationError('No puedes eliminar una cuenta superadmin desde esta pantalla', undefined, 403);
    }
    if (target.role === 'admin' && (await prisma.user.count({ where: { role: 'admin' } })) <= 1) {
      throw new ValidationError('No puedes eliminar al último administrador');
    }
    await prisma.user.delete({ where: { id } });
    await auditLog({ req, action: 'USER_DELETED', entity: 'User', entityId: id, summary: `Usuario eliminado: ${target.email}`, metadata: { role: target.role } });
    return res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    return sendError(error, res, 'Error al eliminar usuario');
  }
}

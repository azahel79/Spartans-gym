// src/middlewares/role.middleware.ts
import { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'recepcionista';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado',
      });
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este recurso',
      });
    }

    next();
  };
}

// Middleware para verificar que SOLO sea admin
export const requireAdmin = requireRole('admin');

// Middleware para verificar que sea admin o recepcionista
export const requireAnyUser = requireRole('admin', 'recepcionista');
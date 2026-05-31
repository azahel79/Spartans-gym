// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  // Error de Prisma (registro duplicado, etc.)
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      error: `El campo ${err.meta?.target?.[0]} ya existe`,
    });
  }

  // Error de Prisma (registro no encontrado)
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Registro no encontrado',
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
  });
}
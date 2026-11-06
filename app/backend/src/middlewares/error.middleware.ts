import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ValidationError } from '../utils/validation';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({ success: false, error: err.message, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: err.code === 'LIMIT_FILE_SIZE' ? 'El archivo no puede superar 5 MB' : 'Archivo inválido',
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'valor';
      return res.status(409).json({ success: false, error: `Ya existe un registro con el mismo ${target}` });
    }
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Registro no encontrado' });
    if (err.code === 'P2003') {
      return res.status(409).json({ success: false, error: 'El registro está relacionado con otros datos y no puede eliminarse' });
    }
  }

  return res.status(500).json({ success: false, error: 'Error interno del servidor' });
}

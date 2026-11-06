// src/routes/auth.routes.ts
import { Router } from 'express';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import { login, getMe, logout } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Rutas públicas
router.post('/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos',
}), login);

// Rutas protegidas
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;

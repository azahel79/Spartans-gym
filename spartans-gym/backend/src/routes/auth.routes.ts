// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, getMe, logout } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Rutas públicas
router.post('/login', login);

// Rutas protegidas
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
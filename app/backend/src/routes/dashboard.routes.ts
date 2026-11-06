// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser } from '../middlewares/role.middleware';

const router = Router();

router.get('/stats', authenticate, requireAnyUser, getDashboardStats);

export default router;
// backend/src/routes/plan.routes.ts
import { Router } from 'express';
import {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '../controllers/plan.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Rutas públicas (requieren autenticación)
router.use(authenticate);

// Obtener planes - Admin y Recepcionista pueden ver
router.get('/', getPlans);
router.get('/:id', getPlanById);

// Solo admin puede modificar planes
router.post('/', requireAdmin, createPlan);
router.put('/:id', requireAdmin, updatePlan);
router.delete('/:id', requireAdmin, deletePlan);

export default router;
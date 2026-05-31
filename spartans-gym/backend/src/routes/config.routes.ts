// backend/src/routes/config.routes.ts
import { Router } from 'express';
import { getGymConfig, updateGymConfig } from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación y ser admin
router.use(authenticate);
router.use(requireAdmin);

router.get('/gym', getGymConfig);
router.put('/gym', updateGymConfig);

export default router;
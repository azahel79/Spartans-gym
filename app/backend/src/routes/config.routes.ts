import { Router } from 'express';
import { getGymConfig, updateGymConfig } from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// La identidad visual debe poder cargarse antes del login.
router.get('/gym', getGymConfig);
router.put('/gym', authenticate, requireAdmin, updateGymConfig);

export default router;

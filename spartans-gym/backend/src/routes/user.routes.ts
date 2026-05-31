// backend/src/routes/user.routes.ts
import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUserRole,
  deleteUser,
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(authenticate);
router.use(requireAdmin);

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;
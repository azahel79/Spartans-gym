// src/routes/transaction.routes.ts
import { Router } from 'express';
import {
  getTransactions,
  getHistory,
  createTransaction,
} from '../controllers/transaction.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas de transacciones requieren autenticación
router.use(authenticate);
router.use(requireAnyUser);

router.get('/', getTransactions);
router.get('/history', getHistory);
router.post('/', createTransaction);

export default router;
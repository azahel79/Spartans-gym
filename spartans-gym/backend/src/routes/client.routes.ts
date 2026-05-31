// src/routes/client.routes.ts
import { Router } from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  registerAttendance,
  renewMembership,
} from '../controllers/client.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser, requireAdmin } from '../middlewares/role.middleware';

const router = Router();

// Todas las rutas de clientes requieren autenticación
router.use(authenticate);

// Rutas accesibles para admin y recepcionista
router.get('/', requireAnyUser, getClients);
router.get('/:id', requireAnyUser, getClientById);
router.post('/', requireAnyUser, createClient);
router.post('/:id/attendance', requireAnyUser, registerAttendance);
router.post('/:id/renew', requireAnyUser, renewMembership);

// Rutas SOLO para admin
router.put('/:id', requireAdmin, updateClient);
router.delete('/:id', requireAdmin, deleteClient);

export default router;
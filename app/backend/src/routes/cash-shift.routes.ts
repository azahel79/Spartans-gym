import { Router } from 'express';
import {
  closeCurrentShift,
  downloadCashShiftCsv,
  getCashShiftById,
  getCurrentShift,
  listCashShifts,
  openShift,
  previewCurrentShift,
} from '../controllers/cash-shift.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser } from '../middlewares/role.middleware';

const router = Router();
router.use(authenticate, requireAnyUser);
router.get('/current', getCurrentShift);
router.get('/current/report', previewCurrentShift);
router.post('/open', openShift);
router.post('/current/close', closeCurrentShift);
router.get('/', listCashShifts);
router.get('/:id/csv', downloadCashShiftCsv);
router.get('/:id', getCashShiftById);

export default router;

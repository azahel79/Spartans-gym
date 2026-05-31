import { Router } from 'express';
import { getAttendances } from '../controllers/attendance.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);
router.use(requireAnyUser);

router.get('/', getAttendances);

export default router;

import { Router } from 'express';
import { getNotifications, getWhatsAppSession, restartWhatsAppSession, retryNotification, runNotificationScan, testWhatsAppConnection } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/whatsapp-session', getWhatsAppSession);
router.post('/whatsapp-session/restart', restartWhatsAppSession);
router.get('/', getNotifications);
router.post('/scan', runNotificationScan);
router.post('/test-whatsapp', testWhatsAppConnection);
router.post('/:id/retry', retryNotification);

export default router;




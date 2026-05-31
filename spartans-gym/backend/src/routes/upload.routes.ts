// backend/src/routes/upload.routes.ts
import { Router } from 'express';
import { uploadLogo } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';
import { upload } from '../config/multer';

const router = Router();

// Solo admin puede subir logo
router.post('/logo', authenticate, requireAdmin, upload.single('logo'), uploadLogo);

export default router;
import { Router } from 'express';
import { uploadAppearanceImage, uploadLogo } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/role.middleware';
import { upload } from '../config/multer';

const router = Router();
router.use(authenticate, requireAdmin);
router.post('/logo', upload.single('logo'), uploadLogo);
router.post('/appearance', upload.single('image'), uploadAppearanceImage);

export default router;

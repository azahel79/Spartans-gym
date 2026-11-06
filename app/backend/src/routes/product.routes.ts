// src/routes/product.routes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAnyUser, requireAdmin } from '../middlewares/role.middleware';
import { upload } from '../config/multer';

const router = Router();

// Todas las rutas de productos requieren autenticación
router.use(authenticate);

// Rutas accesibles para admin y recepcionista (solo lectura)
router.get('/', requireAnyUser, getProducts);
router.get('/:id', requireAnyUser, getProductById);

// Rutas SOLO para admin (escritura)
router.post('/', requireAdmin, upload.single('image'), createProduct);
router.put('/:id', requireAdmin, upload.single('image'), updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);
router.patch('/:id/stock', requireAdmin, adjustStock);

export default router;
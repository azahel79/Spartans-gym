// src/config/multer.ts
import multer from 'multer';
import path from 'path';

// Configuración de memoria (no guardar en disco)
const storage = multer.memoryStorage();

// Filtro para solo permitir imágenes
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de archivo no permitido. Solo JPG, PNG, WEBP, GIF'), false);
  }
};

// Configurar multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Límite 5MB
  },
});
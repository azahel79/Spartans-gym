// src/services/cloudinary.service.ts
import cloudinary from '../config/cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

const getSafePublicId = (filename: string) => {
  const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
  const safeName = nameWithoutExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${Date.now()}-${safeName || 'product'}`;
};

/**
 * Subir una imagen a Cloudinary
 * @param buffer - Buffer del archivo (desde multer)
 * @param filename - Nombre original del archivo
 * @returns Información de la imagen subida
 */
export async function uploadImage(buffer: Buffer, filename: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'gym-products', // Carpeta en Cloudinary
        public_id: getSafePublicId(filename),
        transformation: [
          { width: 500, height: 500, crop: 'limit' }, // Redimensionar
          { quality: 'auto' }, // Optimizar calidad
          { fetch_format: 'auto' }, // Formato automático (WebP si soporta)
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
          });
        } else {
          reject(new Error('Error al subir la imagen'));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Eliminar una imagen de Cloudinary
 * @param publicId - ID público de la imagen
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error al eliminar imagen de Cloudinary:', error);
    return false;
  }
}

/**
 * Extraer publicId desde una URL de Cloudinary
 * @param url - URL de Cloudinary
 */
export function extractPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
}

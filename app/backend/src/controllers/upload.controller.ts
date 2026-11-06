import { Request, Response } from 'express';
import { UploadApiResponse } from 'cloudinary';
import cloudinary from '../config/cloudinary';

async function uploadBuffer(req: Request, res: Response, options: {
  folder: string;
  width: number;
  height: number;
  crop: 'limit' | 'fill';
}) {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No se proporcionó ninguna imagen' });
    const file = req.file;
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          transformation: [
            { width: options.width, height: options.height, crop: options.crop },
            { quality: 'auto' },
            { fetch_format: 'auto' },
          ],
        },
        (error, uploaded) => error || !uploaded ? reject(error || new Error('Carga incompleta')) : resolve(uploaded)
      );
      stream.end(file.buffer);
    });
    return res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    return res.status(500).json({ success: false, error: 'Error al subir la imagen' });
  }
}

export function uploadLogo(req: Request, res: Response) {
  return uploadBuffer(req, res, { folder: 'gym-branding/logos', width: 500, height: 500, crop: 'limit' });
}

export function uploadAppearanceImage(req: Request, res: Response) {
  return uploadBuffer(req, res, { folder: 'gym-branding/appearance', width: 1920, height: 1080, crop: 'limit' });
}

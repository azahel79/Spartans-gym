// backend/src/controllers/upload.controller.ts
import { Request, Response } from 'express';
import cloudinary from '../config/cloudinary';

export async function uploadLogo(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ninguna imagen',
      });
    }

    // Subir imagen a Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'gym-logos',
          transformation: [
            { width: 200, height: 200, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    res.json({
      success: true,
      data: {
        url: (result as any).secure_url,
        publicId: (result as any).public_id,
      },
    });
  } catch (error) {
    console.error('Error al subir logo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir el logo',
    });
  }
}
// src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { uploadImage, deleteImage, extractPublicIdFromUrl } from '../services/cloudinary.service';

// Helper para calcular el estado del producto según stock
function calculateProductStatus(stock: number, reorder: number): string {
  if (stock <= 0) return 'Agotado';
  if (stock <= reorder) return 'Stock Bajo';
  return 'En Stock';
}

// Obtener todos los productos (con filtros opcionales)
export async function getProducts(req: Request, res: Response) {
  try {
    const { category, search } = req.query;

    const where: any = {};

    if (category && category !== 'Todos') {
      where.cat = category;
    }

    if (search) {
      where.name = { contains: search as string };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const productsWithStatus = products.map(product => ({
      ...product,
      status: calculateProductStatus(product.stock, product.reorder),
    }));

    res.json({
      success: true,
      data: productsWithStatus,
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los productos',
    });
  }
}

// Obtener un producto por ID
export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
      });
    }

    const productWithStatus = {
      ...product,
      status: calculateProductStatus(product.stock, product.reorder),
    };

    res.json({
      success: true,
      data: productWithStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener el producto',
    });
  }
}

// Crear nuevo producto CON IMAGEN (SOLO ADMIN)
export async function createProduct(req: Request, res: Response) {
  try {
    // 🔍 LOG PARA DEBUG - VER QUÉ ESTÁ LLEGANDO
    console.log('========== CREAR PRODUCTO ==========');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    console.log('req.files:', req.files);
    console.log('====================================');

    // EXTRAER DATOS - Soporta tanto JSON como form-data
    let { name, price, cat, sku, stock, reorder } = req.body;
    
    let imageUrl: string | null = null;

    // Si hay imagen en req.file, subir a Cloudinary
    if (req.file) {
      try {
        console.log('📸 Subiendo imagen a Cloudinary...');
        const uploadResult = await uploadImage(req.file.buffer, req.file.originalname);
        imageUrl = uploadResult.url;
        console.log('✅ Imagen subida:', imageUrl);
      } catch (uploadError) {
        console.error('❌ Error al subir imagen:', uploadError);
        return res.status(400).json({
          success: false,
          error: 'Error al subir la imagen. Verifica el formato y tamaño.',
        });
      }
    }

    // VALIDAR CAMPOS REQUERIDOS
    if (!name || !price || !cat || !sku) {
      return res.status(400).json({
        success: false,
        error: `Faltan campos requeridos. Recibido: name=${name}, price=${price}, cat=${cat}, sku=${sku}`,
      });
    }

    // Convertir tipos
    const priceNumber = typeof price === 'string' ? parseFloat(price) : price;
    const stockNumber = stock ? (typeof stock === 'string' ? parseInt(stock) : stock) : 0;
    const reorderNumber = reorder ? (typeof reorder === 'string' ? parseInt(reorder) : reorder) : 5;

    // Verificar si el SKU ya existe
    const existingProduct = await prisma.product.findUnique({
      where: { sku: sku.toString() },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un producto con este SKU',
      });
    }

    // Crear producto
    const newProduct = await prisma.product.create({
      data: {
        name: name.toString(),
        price: priceNumber,
        cat: cat as any,
        sku: sku.toString(),
        stock: stockNumber,
        reorder: reorderNumber,
        image: imageUrl,
      },
    });

    console.log('✅ Producto creado:', newProduct.id, newProduct.name);

    res.status(201).json({
      success: true,
      data: {
        ...newProduct,
        status: calculateProductStatus(newProduct.stock, newProduct.reorder),
      },
    });
  } catch (error) {
    console.error('❌ Error al crear producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear el producto',
    });
  }
}

// Actualizar producto CON IMAGEN (SOLO ADMIN)
export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    let { name, price, cat, sku, stock, reorder, removeImage } = req.body;

    console.log('========== ACTUALIZAR PRODUCTO ==========');
    console.log('ID:', id);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProduct) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    let imageUrl = existingProduct.image;

    // Eliminar imagen si se solicita
    if (removeImage === 'true' && existingProduct.image) {
      const publicId = extractPublicIdFromUrl(existingProduct.image);
      if (publicId) {
        await deleteImage(publicId);
      }
      imageUrl = null;
    }

    // Subir nueva imagen si viene
    if (req.file) {
      if (existingProduct.image) {
        const publicId = extractPublicIdFromUrl(existingProduct.image);
        if (publicId) {
          await deleteImage(publicId);
        }
      }
      try {
        const uploadResult = await uploadImage(req.file.buffer, req.file.originalname);
        imageUrl = uploadResult.url;
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          error: 'Error al subir la imagen',
        });
      }
    }

    // Verificar SKU duplicado
    if (sku && sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findUnique({ where: { sku } });
      if (skuExists) {
        return res.status(400).json({ success: false, error: 'Ya existe otro producto con este SKU' });
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name: name || existingProduct.name,
        price: price ? parseFloat(price) : existingProduct.price,
        cat: cat || existingProduct.cat,
        sku: sku || existingProduct.sku,
        stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
        reorder: reorder !== undefined ? parseInt(reorder) : existingProduct.reorder,
        image: imageUrl,
      },
    });

    res.json({
      success: true,
      data: {
        ...updatedProduct,
        status: calculateProductStatus(updatedProduct.stock, updatedProduct.reorder),
      },
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar el producto' });
  }
}

// Eliminar producto (SOLO ADMIN)
export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
      });
    }

    // Eliminar la imagen de Cloudinary si existe
    if (existingProduct.image) {
      const publicId = extractPublicIdFromUrl(existingProduct.image);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    await prisma.product.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'Producto eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el producto',
    });
  }
}

// Ajustar stock manualmente (SOLO ADMIN)
export async function adjustStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { stock, reason } = req.body;

    if (stock === undefined) {
      return res.status(400).json({
        success: false,
        error: 'El campo stock es requerido',
      });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado',
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: { stock: parseInt(stock) },
    });

    console.log(`📦 Ajuste de stock: ${existingProduct.name} | Nuevo stock: ${stock} | Razón: ${reason || 'No especificada'} | Admin: ${req.user?.email}`);

    const productWithStatus = {
      ...updatedProduct,
      status: calculateProductStatus(updatedProduct.stock, updatedProduct.reorder),
    };

    res.json({
      success: true,
      data: productWithStatus,
    });
  } catch (error) {
    console.error('Error al ajustar stock:', error);
    res.status(500).json({
      success: false,
      error: 'Error al ajustar el stock',
    });
  }
}
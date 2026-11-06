import { Category, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { deleteImage, extractPublicIdFromUrl, uploadImage } from '../services/cloudinary.service';
import { cleanString, parseEnum, parseId, parseInteger, parsePositiveNumber, ValidationError } from '../utils/validation';
import { auditLog } from '../services/audit-log.service';

const CATEGORIES = ['Suplementos', 'Bebidas', 'Snacks', 'Merchandising', 'Accesorios'] as const;

function status(stock: number, reorder: number) {
  if (stock <= 0) return 'Agotado';
  if (stock <= reorder) return 'Stock Bajo';
  return 'En Stock';
}

function serialize<T extends { price: unknown; stock: number; reorder: number }>(product: T) {
  return { ...product, price: Number(product.price), status: status(product.stock, product.reorder) };
}

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

export async function getProducts(req: Request, res: Response) {
  try {
    const where: Prisma.ProductWhereInput = {};
    if (req.query.category && req.query.category !== 'Todos') {
      where.cat = parseEnum(req.query.category, 'Categoría', CATEGORIES) as Category;
    }
    if (req.query.search) where.name = { contains: cleanString(req.query.search, 'Búsqueda', { max: 100 }), mode: 'insensitive' };
    const products = await prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 });
    return res.json({ success: true, data: products.map(serialize) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener los productos');
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseId(req.params.id) } });
    if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    return res.json({ success: true, data: serialize(product) });
  } catch (error) {
    return sendError(error, res, 'Error al obtener el producto');
  }
}

export async function createProduct(req: Request, res: Response) {
  let uploadedImage: string | null = null;
  try {
    const name = cleanString(req.body.name, 'Nombre', { min: 2, max: 120 });
    const price = parsePositiveNumber(req.body.price, 'Precio', { max: 1_000_000 });
    const cat = parseEnum(req.body.cat, 'Categoría', CATEGORIES) as Category;
    const sku = cleanString(req.body.sku, 'SKU', { min: 2, max: 80 }).toUpperCase();
    const stock = req.body.stock === undefined || req.body.stock === '' ? 0 : parseInteger(req.body.stock, 'Stock', { min: 0, max: 10_000_000 });
    const reorder = req.body.reorder === undefined || req.body.reorder === '' ? 5 : parseInteger(req.body.reorder, 'Stock mínimo', { min: 0, max: 10_000_000 });

    const file = req.file;
    if (file) {
      const result = await uploadImage(file.buffer, file.originalname);
      uploadedImage = result.url;
    }
    const product = await prisma.product.create({ data: { name, price, cat, sku, stock, reorder, image: uploadedImage } });
    await auditLog({ req, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id, summary: `Producto creado: ${product.name}`, metadata: { sku: product.sku, stock: product.stock, price: Number(product.price) } });
    return res.status(201).json({ success: true, data: serialize(product) });
  } catch (error) {
    if (uploadedImage) {
      const publicId = extractPublicIdFromUrl(uploadedImage);
      if (publicId) await deleteImage(publicId).catch(() => undefined);
    }
    return sendError(error, res, 'Error al crear el producto');
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    let image = existing.image;
    let newImage: string | null = null;
    const file = req.file;
    if (file) {
      const result = await uploadImage(file.buffer, file.originalname);
      newImage = result.url;
      image = newImage;
    } else if (req.body.removeImage === 'true') {
      image = null;
    }

    const data: Prisma.ProductUpdateInput = { image };
    if (req.body.name !== undefined) data.name = cleanString(req.body.name, 'Nombre', { min: 2, max: 120 });
    if (req.body.price !== undefined) data.price = parsePositiveNumber(req.body.price, 'Precio', { max: 1_000_000 });
    if (req.body.cat !== undefined) data.cat = parseEnum(req.body.cat, 'Categoría', CATEGORIES) as Category;
    if (req.body.sku !== undefined) data.sku = cleanString(req.body.sku, 'SKU', { min: 2, max: 80 }).toUpperCase();
    if (req.body.stock !== undefined) data.stock = parseInteger(req.body.stock, 'Stock', { min: 0, max: 10_000_000 });
    if (req.body.reorder !== undefined) data.reorder = parseInteger(req.body.reorder, 'Stock mínimo', { min: 0, max: 10_000_000 });

    try {
      const product = await prisma.product.update({ where: { id }, data });
      await auditLog({ req, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: product.id, summary: `Producto actualizado: ${product.name}`, metadata: { fields: Object.keys(data) } });
      if ((newImage || req.body.removeImage === 'true') && existing.image) {
        const oldPublicId = extractPublicIdFromUrl(existing.image);
        if (oldPublicId) await deleteImage(oldPublicId).catch(() => undefined);
      }
      return res.json({ success: true, data: serialize(product) });
    } catch (error) {
      if (newImage) {
        const publicId = extractPublicIdFromUrl(newImage);
        if (publicId) await deleteImage(publicId).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    return sendError(error, res, 'Error al actualizar el producto');
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    await prisma.product.delete({ where: { id } });
    await auditLog({ req, action: 'PRODUCT_DELETED', entity: 'Product', entityId: id, summary: `Producto eliminado: ${product.name}`, metadata: { sku: product.sku } });
    if (product.image) {
      const publicId = extractPublicIdFromUrl(product.image);
      if (publicId) await deleteImage(publicId).catch(() => undefined);
    }
    return res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    return sendError(error, res, 'Error al eliminar el producto');
  }
}

export async function adjustStock(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    const stock = parseInteger(req.body.stock, 'Stock', { min: 0, max: 10_000_000 });
    const reason = req.body.reason ? cleanString(req.body.reason, 'Motivo', { max: 250 }) : 'No especificado';
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    const product = await prisma.product.update({ where: { id }, data: { stock } });
    console.info(`Ajuste de stock: ${existing.name}; stock=${stock}; motivo=${reason}; admin=${req.user?.email}`);
    await auditLog({ req, action: 'PRODUCT_STOCK_ADJUSTED', entity: 'Product', entityId: id, summary: `Stock ajustado: ${existing.name}`, metadata: { previousStock: existing.stock, newStock: stock, reason } });
    return res.json({ success: true, data: serialize(product) });
  } catch (error) {
    return sendError(error, res, 'Error al ajustar el stock');
  }
}

import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = `http://localhost:${process.env.PORT || 3000}/api`;
const suffix = Date.now().toString();
const sku = `SMOKE-${suffix}`;
const phone = `55${suffix.slice(-8)}`;
let productId: number | undefined;
let clientId: string | undefined;

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.error || path}`);
  return body;
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }),
  });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };

  const product = await request('/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `Producto prueba ${suffix}`, price: 25, cat: 'Bebidas', sku, stock: 5, reorder: 1 }),
  });
  productId = product.data.id;

  const sale = await request('/transactions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tipo: 'PRODUCTO', metodo: 'Efectivo', monto: 0.01, productos: [{ id: productId, quantity: 2 }] }),
  });
  assert.equal(sale.data.monto, 50, 'El backend debe recalcular el total');

  const productAfterSale = await request(`/products/${productId}`, { headers });
  assert.equal(productAfterSale.data.stock, 3, 'La venta debe descontar stock');

  const plans = await request('/plans', { headers });
  assert.ok(plans.data.length > 0, 'Debe existir al menos un plan');
  const selectedPlan = plans.data[0];

  const client = await request('/clients', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nombre: 'Cliente',
      apellidos: `Prueba ${suffix}`,
      genero: 'Otro',
      telefono: phone,
      plan: selectedPlan.name,
      monto: selectedPlan.price,
      metodoPago: 'Efectivo',
    }),
  });
  clientId = client.data.id;

  const payment = await prisma.transaction.findFirst({ where: { clienteId: clientId, tipo: 'MEMBRESIA' } });
  assert.ok(payment, 'La inscripción debe crear su transacción de membresía');
  assert.equal(Number(payment?.monto), Number(selectedPlan.price));

  console.log('Smoke test passed');
}

main()
  .finally(async () => {
    if (clientId) {
      await prisma.transaction.deleteMany({ where: { clienteId: clientId } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { id: clientId } }).catch(() => undefined);
    }
    if (productId) {
      await prisma.transaction.deleteMany({ where: { concepto: { contains: `Producto prueba ${suffix}` } } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

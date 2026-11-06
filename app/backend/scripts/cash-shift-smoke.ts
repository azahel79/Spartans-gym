import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = `http://localhost:${process.env.PORT || 3000}/api`;
const suffix = Date.now().toString();
const email = `recepcion.prueba.${suffix}@mexa.local`;
const password = `Prueba-${suffix}!`;
const sku = `CORTE-${suffix}`;
const phone = `55${suffix.slice(-8)}`;

let userId: number | undefined;
let adminUserId: number | undefined;
let productId: number | undefined;
let clientId: string | undefined;
let shiftId: string | undefined;
let secondShiftId: string | undefined;

async function request(path: string, options: RequestInit = {}, expectedStatus?: number) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (expectedStatus !== undefined) {
    assert.equal(response.status, expectedStatus, `Estado inesperado en ${path}`);
    return body;
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body ? body.error : path;
    throw new Error(`${response.status} ${message}`);
  }
  return body;
}

async function main() {
  const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  assert.ok(plan, 'Debe existir al menos un plan activo');

  const adminEmail = `admin.prueba.${suffix}@mexa.local`;
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: await bcrypt.hash(password, 10),
      role: 'admin',
    },
  });
  adminUserId = adminUser.id;

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: adminEmail,
      password,
    }),
  }) as { data: { token: string } };
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminLogin.data.token}`,
  };

  await request('/transactions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      tipo: 'PRODUCTO',
      metodo: 'Efectivo',
      productos: [{ id: -1, quantity: 1 }],
    }),
  }, 409);

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      role: 'recepcionista',
    },
  });
  userId = user.id;

  const product = await prisma.product.create({
    data: {
      name: `Producto corte ${suffix}`,
      price: 25,
      cat: 'Bebidas',
      sku,
      stock: 5,
      reorder: 1,
    },
  });
  productId = product.id;

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }) as { data: { token: string } };
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.data.token}`,
  };

  await request('/transactions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tipo: 'PRODUCTO',
      metodo: 'Efectivo',
      productos: [{ id: productId, quantity: 1 }],
    }),
  }, 409);

  const opened = await request('/cash-shifts/open', {
    method: 'POST',
    headers,
    body: JSON.stringify({ shiftType: 'MORNING', openingCash: 100 }),
  }) as { data: { id: string } };
  shiftId = opened.data.id;

  await request('/transactions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tipo: 'PRODUCTO',
      metodo: 'Efectivo',
      productos: [{ id: productId, quantity: 2 }],
    }),
  });

  const client = await request('/clients', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nombre: 'Cliente',
      apellidos: `Corte ${suffix}`,
      genero: 'Otro',
      telefono: phone,
      plan: plan.name,
      monto: Number(plan.price),
      metodoPago: 'Tarjeta',
    }),
  }) as { data: { id: string } };
  clientId = client.data.id;

  await request(`/clients/${clientId}/attendance`, { method: 'POST', headers });
  await request(`/clients/${clientId}/renew`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newPlan: plan.name,
      paymentMethod: 'Transferencia',
      amount: Number(plan.price),
    }),
  });

  const preview = await request('/cash-shifts/current/report', { headers }) as {
    data: {
      summary: {
        productSalesCount: number;
        productSalesTotal: number;
        newMembershipsCount: number;
        renewalsCount: number;
        attendanceCount: number;
        expectedCash: number;
      };
    };
  };
  assert.equal(preview.data.summary.productSalesCount, 1);
  assert.equal(preview.data.summary.productSalesTotal, 50);
  assert.equal(preview.data.summary.newMembershipsCount, 1);
  assert.equal(preview.data.summary.renewalsCount, 1);
  assert.equal(preview.data.summary.attendanceCount, 1);
  assert.equal(preview.data.summary.expectedCash, 150);

  const linkedTransactions = await prisma.transaction.count({
    where: { cashShiftId: shiftId },
  });
  const linkedAttendances = await prisma.attendance.count({
    where: { cashShiftId: shiftId },
  });
  assert.equal(linkedTransactions, 3, 'Venta, inscripción y renovación deben pertenecer al turno');
  assert.equal(linkedAttendances, 1, 'La asistencia debe pertenecer al turno');

  const closed = await request('/cash-shifts/current/close', {
    method: 'POST',
    headers,
    body: JSON.stringify({ declaredCash: 150, closingNotes: 'Prueba automatizada' }),
  }) as { data: { difference: number; status: string } };
  assert.equal(closed.data.status, 'CLOSED');
  assert.equal(closed.data.difference, 0);

  const csv = await request(`/cash-shifts/${shiftId}/csv`, { headers }) as string;
  assert.match(csv, /REPORTE DE CORTE DE CAJA/);
  assert.match(csv, /MOVIMIENTOS/);
  assert.match(csv, /ASISTENCIAS/);
  assert.match(csv, /RENOVACION/);

  const secondOpened = await request('/cash-shifts/open', {
    method: 'POST',
    headers,
    body: JSON.stringify({ shiftType: 'EVENING', openingCash: 300 }),
  }) as { data: { id: string } };
  secondShiftId = secondOpened.data.id;

  const secondPreview = await request('/cash-shifts/current/report', { headers }) as {
    data: { summary: { transactionCount: number; attendanceCount: number; expectedCash: number } };
  };
  assert.equal(secondPreview.data.summary.transactionCount, 0, 'El segundo turno no debe heredar movimientos del primero');
  assert.equal(secondPreview.data.summary.attendanceCount, 0, 'El segundo turno no debe heredar asistencias del primero');
  assert.equal(secondPreview.data.summary.expectedCash, 300, 'El fondo del segundo turno debe calcularse por separado');

  await request('/cash-shifts/current/close', {
    method: 'POST',
    headers,
    body: JSON.stringify({ declaredCash: 300 }),
  });

  console.log('Cash shift smoke test passed');
}

main()
  .finally(async () => {
    if (clientId) {
      await prisma.notification.deleteMany({ where: { clientId } }).catch(() => undefined);
      await prisma.attendance.deleteMany({ where: { clientId } }).catch(() => undefined);
      await prisma.transaction.deleteMany({ where: { clienteId: clientId } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { id: clientId } }).catch(() => undefined);
    }
    if (productId) {
      await prisma.transaction.deleteMany({ where: { productId } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: productId } }).catch(() => undefined);
    }
    if (shiftId) await prisma.cashShift.deleteMany({ where: { id: shiftId } }).catch(() => undefined);
    if (secondShiftId) await prisma.cashShift.deleteMany({ where: { id: secondShiftId } }).catch(() => undefined);
    if (userId) await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } }).catch(() => undefined);
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

// backend/src/controllers/transaction.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';



function getLocalDateRange(dateStr: string) {
  // Crear fecha en zona local (interpretando YYYY-MM-DD como fecha local)
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Fecha inicio: 00:00:00 hora local
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Fecha fin: 23:59:59.999 hora local
  const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  // Convertir a UTC para comparar con createdAt (que está en UTC)
  return {
    startUTC: startDate,
    endUTC: endDate,
  };
}

function getMexicoCityDateRange(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const mexicoCityOffsetHours = 6;

  return {
    startUTC: new Date(Date.UTC(year, month - 1, day, mexicoCityOffsetHours, 0, 0, 0)),
    endUTC: new Date(Date.UTC(year, month - 1, day + 1, mexicoCityOffsetHours, 0, 0, -1)),
  };
}

export async function getTransactions(req: Request, res: Response) {
  try {
    const { tipo, metodo, fechaInicio, fechaFin } = req.query;

    const where: any = {};

    if (tipo) where.tipo = tipo;
    if (metodo) where.metodo = metodo;

    // ✅ FILTRO POR RANGO DE FECHAS ajustado a zona horaria local
    if (fechaInicio) {
      const { startUTC, endUTC } = getMexicoCityDateRange(fechaInicio as string);
      
      where.createdAt = {
        gte: startUTC,
        lte: endUTC,
      };
      
      console.log(`📅 Filtro para ${fechaInicio}:`);
      console.log(`   Inicio UTC: ${startUTC.toISOString()}`);
      console.log(`   Fin UTC: ${endUTC.toISOString()}`);
    }
    
    // Si hay fechaFin, ajustar también
    if (fechaFin && fechaFin !== fechaInicio) {
      const { startUTC, endUTC } = getMexicoCityDateRange(fechaFin as string);
      
      where.createdAt = {
        ...where.createdAt,
        lte: endUTC,
      };
    }

    console.log('🔍 Where clause:', JSON.stringify(where, null, 2));

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    const transactionsWithNumbers = transactions.map(t => ({
      ...t,
      monto: typeof t.monto === 'object' ? Number(t.monto) : t.monto,
    }));

    console.log(`✅ Se encontraron ${transactions.length} transacciones`);

    res.json({
      success: true,
      data: transactionsWithNumbers,
    });
  } catch (error) {
    console.error('❌ Error al obtener transacciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las transacciones',
    });
  }
}

// Obtener historial completo (sin filtros)
export async function getHistory(req: Request, res: Response) {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const transactionsWithNumbers = transactions.map(t => ({
      ...t,
      monto: typeof t.monto === 'object' ? Number(t.monto) : t.monto,
    }));

    res.json({
      success: true,
      data: transactionsWithNumbers,
    });
  } catch (error) {
    console.error('❌ Error al obtener el historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el historial',
    });
  }
}

// Crear nueva transacción
export async function createTransaction(req: Request, res: Response) {
  try {
    const { tipo, metodo, monto, clienteId, concepto, productos } = req.body;

    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    const hora = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });

    let nombre = 'Venta';
    let apellidos = 'Mostrador';
    let conceptoFinal = concepto || '';
    let clienteIdFinal = clienteId || null;

    // Si es venta de productos (POS)
    if (tipo === 'PRODUCTO' && productos && productos.length > 0) {
      const productNames: string[] = [];
      for (const item of productos) {
        const product = await prisma.product.findUnique({
          where: { id: item.id },
        });
        if (product) {
          const quantityText = item.quantity > 1 ? ` (x${item.quantity})` : '';
          productNames.push(`${product.name}${quantityText}`);
          
          // Actualizar stock
          await prisma.product.update({
            where: { id: item.id },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
      conceptoFinal = productNames.join(', ');
    }

    // Si es membresía, obtener datos del cliente
    if (tipo === 'MEMBRESIA' && clienteId) {
      const client = await prisma.client.findUnique({
        where: { id: clienteId },
      });
      if (client) {
        nombre = client.nombre;
        apellidos = client.apellidos;
      }
    }

    const newTransaction = await prisma.transaction.create({
      data: {
        fecha,
        hora,
        nombre,
        apellidos,
        clienteId: clienteIdFinal,
        concepto: conceptoFinal,
        monto,
        metodo: metodo as any,
        tipo: tipo as any,
        userId: req.user?.id,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...newTransaction,
        monto: Number(newTransaction.monto),
      },
    });
  } catch (error) {
    console.error('❌ Error al crear transacción:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la transacción',
    });
  }
}

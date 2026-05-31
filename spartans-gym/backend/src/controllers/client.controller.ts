// src/controllers/client.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';

function calculateExpiryDate(baseDate: Date, plan: string): Date {
  const expiry = new Date(baseDate);
  switch (plan) {
    case 'Mensual':
      expiry.setMonth(expiry.getMonth() + 1);
      break;
    case 'Trimestral':
      expiry.setMonth(expiry.getMonth() + 3);
      break;
    case 'Semestral':
      expiry.setMonth(expiry.getMonth() + 6);
      break;
    case 'Anual':
      expiry.setFullYear(expiry.getFullYear() + 1);
      break;
  }
  return expiry;
}

// Crear un nuevo cliente (MODIFICADO - email removido, genero agregado)
export async function createClient(req: Request, res: Response) {
  try {
    const { nombre, apellidos, genero, telefono, plan, monto, metodoPago, fotoUrl } = req.body;

    // Validar campos requeridos (email ya no es requerido)
    if (!nombre || !apellidos || !genero || !telefono || !plan || !monto || !metodoPago) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: nombre, apellidos, genero, telefono, plan, monto, metodoPago',
      });
    }

    // Validar que el género sea válido
    if (!['Masculino', 'Femenino', 'Otro'].includes(genero)) {
      return res.status(400).json({
        success: false,
        error: 'Género inválido. Debe ser: Masculino, Femenino o Otro',
      });
    }

    // Calcular fecha de vencimiento
    const now = new Date();
    const vencimiento = calculateExpiryDate(now, plan);

    const newClient = await prisma.client.create({
      data: {
        nombre,
        apellidos,
        genero: genero as any,
        telefono,
        plan: plan as any,
        monto,
        metodoPago: metodoPago as any,
        status: 'ACTIVO',
        ultimaVisita: '--:--',
        vencimiento,
        fotoUrl: fotoUrl || null,
      },
    });

    res.status(201).json({
      success: true,
      data: newClient,
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear el cliente',
    });
  }
}

// Obtener todos los clientes (MODIFICADO - sin email en búsqueda)
export async function getClients(req: Request, res: Response) {
  try {
    const { status, plan, search } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { nombre: { contains: search as string } },
        { apellidos: { contains: search as string } },
        { telefono: { contains: search as string } }, // Buscar por teléfono en lugar de email
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los clientes',
    });
  }
}

// Actualizar cliente (MODIFICADO)
export async function updateClient(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { nombre, apellidos, genero, telefono, plan, monto, metodoPago, fotoUrl } = req.body;

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        nombre: nombre || existingClient.nombre,
        apellidos: apellidos || existingClient.apellidos,
        genero: genero || existingClient.genero,
        telefono: telefono || existingClient.telefono,
        plan: plan || existingClient.plan,
        monto: monto || existingClient.monto,
        metodoPago: metodoPago || existingClient.metodoPago,
        fotoUrl: fotoUrl !== undefined ? fotoUrl : existingClient.fotoUrl,
      },
    });

    res.json({
      success: true,
      data: updatedClient,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el cliente',
    });
  }
}


// Obtener un cliente por ID
export async function getClientById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener el cliente',
    });
  }
}

// Eliminar cliente (solo admin)
export async function deleteClient(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    await prisma.client.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Cliente eliminado correctamente',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el cliente',
    });
  }
}

// Registrar asistencia
export async function registerAttendance(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    // ✅ Verificar membresía vigente (comparando solo fechas, sin horas)
    const today = new Date();
    const expiryDate = new Date(client.vencimiento);
    
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      return res.status(403).json({
        success: false,
        error: 'Membresía vencida',
      });
    }

    // ✅ Verificar si ya asistió HOY (comparando solo fecha, sin horas)
    const startOfToday = new Date(today);
    const startOfTomorrow = new Date(today);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const attendanceToday = await prisma.attendance.findFirst({
      where: {
        clientId: id,
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    });

    const todayStr = today.toISOString().split('T')[0];
    const lastAttendance = client.attendanceDate?.toISOString().split('T')[0];

    console.log(`📅 Hoy: ${todayStr}, Última asistencia: ${lastAttendance || 'null'}`);

    if (attendanceToday || lastAttendance === todayStr) {
      return res.status(400).json({
        success: false,
        error: 'El cliente ya registró asistencia hoy',
      });
    }

    // ✅ Formatear hora actual
    const horaActual = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',  
      hour12: true,     
    });

    // ✅ Registrar asistencia (guardar con la fecha actual)
    const attendanceDate = new Date();
    const attendanceUser = req.user?.id
      ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true } })
      : null;

    const [updatedClient, attendance] = await prisma.$transaction([
      prisma.client.update({
        where: { id },
        data: {
          ultimaVisita: horaActual,
          attendanceDate,
        },
      }),
      prisma.attendance.create({
        data: {
          clientId: id,
          userId: attendanceUser?.id,
          fecha: attendanceDate,
          hora: horaActual,
        },
      }),
    ]);

    console.log(`✅ Asistencia registrada para ${client.nombre} ${client.apellidos} a las ${horaActual}`);

    res.json({
      success: true,
      data: {
        ultimaVisita: updatedClient.ultimaVisita,
        attendanceDate: updatedClient.attendanceDate,
        attendanceId: attendance.id,
      },
    });
  } catch (error) {
    console.error('❌ Error al registrar asistencia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar asistencia',
    });
  }
}

// Renovar membresía
export async function renewMembership(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { newPlan, amount, paymentMethod } = req.body;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    // Calcular nueva fecha de vencimiento
    const now = new Date();
    const currentExpiry = new Date(client.vencimiento);
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = calculateExpiryDate(baseDate, newPlan);

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        plan: newPlan as any,
        monto: amount,
        metodoPago: paymentMethod as any,
        vencimiento: newExpiry,
        status: 'ACTIVO',
      },
    });

    res.json({
      success: true,
      data: {
        plan: updatedClient.plan,
        monto: updatedClient.monto,
        vencimiento: updatedClient.vencimiento,
        status: updatedClient.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al renovar membresía',
    });
  }
}

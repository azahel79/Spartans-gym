import { Request, Response } from 'express';
import { prisma } from '../config/database';

function getLocalDateRange(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);

  return {
    startUTC: new Date(year, month - 1, day, 0, 0, 0, 0),
    endUTC: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
}

export async function getAttendances(req: Request, res: Response) {
  try {
    const { fechaInicio, fechaFin, status, plan, search } = req.query;

    const where: any = {};

    if (fechaInicio) {
      const { startUTC, endUTC } = getLocalDateRange(fechaInicio as string);
      where.fecha = {
        gte: startUTC,
        lte: endUTC,
      };
    }

    if (fechaFin && fechaFin !== fechaInicio) {
      const { endUTC } = getLocalDateRange(fechaFin as string);
      where.fecha = {
        ...where.fecha,
        lte: endUTC,
      };
    }

    if (status && status !== 'Todos') {
      where.client = {
        ...where.client,
        status,
      };
    }

    if (plan && plan !== 'Cualquiera' && plan !== 'Todos los planes') {
      where.client = {
        ...where.client,
        plan,
      };
    }

    if (search) {
      const searchValue = search as string;
      where.client = {
        ...where.client,
        OR: [
          { nombre: { contains: searchValue } },
          { apellidos: { contains: searchValue } },
          { telefono: { contains: searchValue } },
        ],
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            telefono: true,
            plan: true,
            metodoPago: true,
            status: true,
            fotoUrl: true,
            vencimiento: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: attendances.map((attendance) => ({
        id: attendance.id,
        clientId: attendance.clientId,
        userId: attendance.userId,
        fecha: attendance.fecha,
        hora: attendance.hora,
        createdAt: attendance.createdAt,
        nombre: attendance.client.nombre,
        apellidos: attendance.client.apellidos,
        telefono: attendance.client.telefono,
        plan: attendance.client.plan,
        metodoPago: attendance.client.metodoPago,
        status: attendance.client.status,
        fotoUrl: attendance.client.fotoUrl,
        vencimiento: attendance.client.vencimiento,
        user: attendance.user,
      })),
    });
  } catch (error) {
    console.error('Error al obtener asistencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener asistencias',
    });
  }
}

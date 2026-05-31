// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';

// Obtener estadísticas para el dashboard (con diferenciación por rol)
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin';

    // Fecha actual y primer día del mes
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Obtener transacciones del mes actual
    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
          lt: nextMonth,
        },
      },
    });

    // Calcular ingresos totales del mes
    const ingresosTotalesMes = monthlyTransactions.reduce((sum, t) => sum + Number(t.monto), 0);
    const metaMensual = 60000;
    const porcentajeMeta = (ingresosTotalesMes / metaMensual) * 100;

    // Total de movimientos (transacciones)
    const totalMovimientos = await prisma.transaction.count();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [activeClients, todayAttendances] = await Promise.all([
      prisma.client.count({ where: { status: 'ACTIVO' } }),
      prisma.attendance.count({
        where: {
          fecha: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
        },
      }),
    ]);

    const ocupacionActual = activeClients > 0
      ? Math.min(Math.round((todayAttendances / activeClients) * 100), 100)
      : 0;

    // Próximos vencimientos (clientes que vencen en los próximos 7 días)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingExpirations = await prisma.client.findMany({
      where: {
        status: 'ACTIVO',
        vencimiento: {
          gte: today,
          lte: nextWeek,
        },
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        plan: true,
        vencimiento: true,
        fotoUrl: true,
        status: true,
      },
      orderBy: { vencimiento: 'asc' },
      take: 5,
    });

    const proximosVencimientos = upcomingExpirations.map(c => ({
      id: c.id,
      nombre: c.nombre,
      apellidos: c.apellidos,
      dias: Math.ceil((c.vencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      diasFaltantes: Math.ceil((c.vencimiento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      plan: c.plan,
      fotoUrl: c.fotoUrl,
      status: c.status,
    }));

    // Actividad reciente (últimas 5 transacciones)
    const [recentTransactions, recentAttendances] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.attendance.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          client: {
            select: {
              nombre: true,
              apellidos: true,
            },
          },
        },
      }),
    ]);

    const actividadReciente = [
      ...recentTransactions.map(t => ({
        id: `trx-${t.id}`,
        usuario: `${t.nombre} ${t.apellidos}`,
        accion: t.concepto,
        area: t.metodo,
        hora: t.hora,
        tipo: t.tipo === 'MEMBRESIA' ? 'check' : 'pago',
        monto: Number(t.monto),
        createdAt: t.createdAt,
      })),
      ...recentAttendances.map(a => ({
        id: `att-${a.id}`,
        usuario: `${a.client.nombre} ${a.client.apellidos}`,
        accion: 'Registro de asistencia',
        area: 'Recepcion',
        hora: a.hora,
        tipo: 'check',
        monto: 0,
        createdAt: a.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const todayAttendanceRows = await prisma.attendance.findMany({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
      select: { fecha: true },
    });

    const hourlyAttendance = new Map<string, number>();
    for (const attendance of todayAttendanceRows) {
      const hour = attendance.fecha.getHours().toString().padStart(2, '0');
      const key = `${hour}:00`;
      hourlyAttendance.set(key, (hourlyAttendance.get(key) || 0) + 1);
    }

    const afluenciaPorHora = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((hora) => ({
      hora,
      valor: hourlyAttendance.get(hora) || 0,
    }));

    const weekStart = new Date(startOfToday);
    weekStart.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [weekAttendances, weekTransactions] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          fecha: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        select: { fecha: true },
      }),
      prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        select: { createdAt: true },
      }),
    ]);

    const dayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const attendanceByDay = new Map(dayLabels.map((day) => [day, 0]));
    const transactionsByDay = new Map(dayLabels.map((day) => [day, 0]));
    const getDayLabel = (date: Date) => dayLabels[(date.getDay() + 6) % 7];

    for (const attendance of weekAttendances) {
      const day = getDayLabel(attendance.fecha);
      attendanceByDay.set(day, (attendanceByDay.get(day) || 0) + 1);
    }

    for (const transaction of weekTransactions) {
      const day = getDayLabel(transaction.createdAt);
      transactionsByDay.set(day, (transactionsByDay.get(day) || 0) + 1);
    }

    const afluenciaPorDia = dayLabels.map((dia) => ({
      dia,
      real: attendanceByDay.get(dia) || 0,
      proyectado: transactionsByDay.get(dia) || 0,
    }));

    // Construir respuesta según el rol
    const baseData = {
      totalMovimientos,
      ocupacionActual,
      proximosVencimientos,
      actividadReciente,
      afluenciaPorHora,
      afluenciaPorDia,
    };

    if (isAdmin) {
      // Admin recibe datos financieros completos
      res.json({
        success: true,
        data: {
          ...baseData,
          ingresosTotalesMes,
          metaMensual,
          porcentajeMeta: Math.min(porcentajeMeta, 100),
        },
      });
    } else {
      // Recepcionista NO recibe datos financieros
      res.json({
        success: true,
        data: baseData,
      });
    }
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las estadísticas del dashboard',
    });
  }
}

// backend/src/controllers/plan.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';

// Obtener todos los planes activos
export async function getPlans(req: Request, res: Response) {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Convertir Decimal a number para el frontend
    const plansWithNumber = plans.map(plan => ({
      ...plan,
      price: Number(plan.price),
    }));

    console.log(`✅ Se encontraron ${plans.length} planes`);

    res.json({
      success: true,
      data: plansWithNumber,
    });
  } catch (error) {
    console.error('❌ Error al obtener planes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener planes',
    });
  }
}

// Obtener un plan por ID
export async function getPlanById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado',
      });
    }

    res.json({
      success: true,
      data: {
        ...plan,
        price: Number(plan.price),
      },
    });
  } catch (error) {
    console.error('❌ Error al obtener plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener plan',
    });
  }
}

// Crear nuevo plan (solo admin)
export async function createPlan(req: Request, res: Response) {
  try {
    const { name, price, period, color } = req.body;

    console.log(`📝 Creando plan: ${name}, precio: ${price}`);

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y precio son requeridos',
      });
    }

    // Verificar si ya existe un plan con ese nombre
    const existingPlan = await prisma.plan.findUnique({
      where: { name },
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un plan con ese nombre',
      });
    }

    const newPlan = await prisma.plan.create({
      data: {
        name,
        price,
        period: period || 'Mes',
        color: color || 'bg-primary',
        isActive: true,
      },
    });

    console.log(`✅ Plan creado: ${newPlan.name}`);

    res.status(201).json({
      success: true,
      data: {
        ...newPlan,
        price: Number(newPlan.price),
      },
    });
  } catch (error) {
    console.error('❌ Error al crear plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear plan',
    });
  }
}

// Actualizar plan (solo admin)
export async function updatePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, price, period, color, isActive } = req.body;

    console.log(`✏️ Actualizando plan ID: ${id}`);

    const existingPlan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado',
      });
    }

    // Si cambia el nombre, verificar que no exista otro
    if (name && name !== existingPlan.name) {
      const duplicate = await prisma.plan.findUnique({
        where: { name },
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe otro plan con ese nombre',
        });
      }
    }

    const updatedPlan = await prisma.plan.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingPlan.name,
        price: price !== undefined ? price : existingPlan.price,
        period: period !== undefined ? period : existingPlan.period,
        color: color !== undefined ? color : existingPlan.color,
        isActive: isActive !== undefined ? isActive : existingPlan.isActive,
      },
    });

    console.log(`✅ Plan actualizado: ${updatedPlan.name}`);

    res.json({
      success: true,
      data: {
        ...updatedPlan,
        price: Number(updatedPlan.price),
      },
    });
  } catch (error) {
    console.error('❌ Error al actualizar plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar plan',
    });
  }
}

// Eliminar plan (soft delete - solo desactivar) (solo admin)
export async function deletePlan(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log(`🗑️ Eliminando plan ID: ${id}`);

    const existingPlan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        error: 'Plan no encontrado',
      });
    }

    // Soft delete - solo desactivar
    const deletedPlan = await prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`✅ Plan desactivado: ${deletedPlan.name}`);

    res.json({
      success: true,
      message: 'Plan eliminado correctamente',
    });
  } catch (error) {
    console.error('❌ Error al eliminar plan:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar plan',
    });
  }
}
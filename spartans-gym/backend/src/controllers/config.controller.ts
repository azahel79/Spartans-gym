// backend/src/controllers/config.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';

// Obtener configuración del gimnasio
export async function getGymConfig(req: Request, res: Response) {
  try {
    // Buscar configuración (solo debe haber un registro)
    let config = await prisma.gymConfig.findFirst();
    
    if (!config) {
      // Crear configuración por defecto
      config = await prisma.gymConfig.create({
        data: {
          name: "SPARTAN'S GYM",
          email: "contacto@spartansgym.com",
          phone: "+52 55 1234 5678",
          address: "Avenida de los Deportes 123, Ciudad de México",
        },
      });
    }
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
    });
  }
}

// Actualizar configuración del gimnasio
export async function updateGymConfig(req: Request, res: Response) {
  try {
    const { name, email, phone, address, logo } = req.body;
    
    let config = await prisma.gymConfig.findFirst();
    
    if (!config) {
      config = await prisma.gymConfig.create({
        data: {
          name: name || "SPARTAN'S GYM",
          email: email || "contacto@spartansgym.com",
          phone: phone || "+52 55 1234 5678",
          address: address || "Avenida de los Deportes 123, Ciudad de México",
        },
      });
    } else {
      config = await prisma.gymConfig.update({
        where: { id: config.id },
        data: {
          name: name !== undefined ? name : config.name,
          email: email !== undefined ? email : config.email,
          phone: phone !== undefined ? phone : config.phone,
          address: address !== undefined ? address : config.address,
          logo: logo !== undefined ? logo : config.logo,
        },
      });
    }
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración',
    });
  }
}
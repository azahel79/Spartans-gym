// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { verifyPassword } from '../services/password.service';
import { generateToken } from '../services/token.service';

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
 
    // Validar que los campos existan
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos',
      });
    }

    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales incorrectas',
      });
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales incorrectas',
      });
    }

    // Generar token JWT
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Responder sin enviar la contraseña
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
}

export async function logout(req: Request, res: Response) {
  // El logout se maneja en el frontend eliminando el token
  res.json({
    success: true,
    message: 'Sesión cerrada correctamente',
  });
}
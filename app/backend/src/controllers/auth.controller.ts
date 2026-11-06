import { Request, Response } from 'express'; 
import { prisma } from '../config/database';
import { verifyPassword } from '../services/password.service';
import { generateToken } from '../services/token.service';
import { parseEmail, ValidationError } from '../utils/validation';

export async function login(req: Request, res: Response) {
  try {
    const email = parseEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!password || password.length > 128) throw new ValidationError('Contraseña inválida');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const { password: _password, ...safeUser } = user;
    return res.json({ success: true, data: { token, user: safeUser } });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ success: false, error: error.message });
    console.error('Error en login:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'No autenticado' });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error al consultar sesión:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

export async function logout(_req: Request, res: Response) {
  return res.json({ success: true, message: 'Sesión cerrada correctamente' });
}

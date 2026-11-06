import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { prisma, testConnection } from './config/database';
import { errorHandler } from './middlewares/error.middleware';

import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import productRoutes from './routes/product.routes';
import transactionRoutes from './routes/transaction.routes';
import dashboardRoutes from './routes/dashboard.routes';
import configRoutes from './routes/config.routes';
import uploadRoutes from './routes/upload.routes';   
import userRoutes from './routes/user.routes';   
import planRoutes from './routes/plan.routes';
import attendanceRoutes from './routes/attendance.routes';
import notificationRoutes from './routes/notification.routes';
import cashShiftRoutes from './routes/cash-shift.routes';
import workoutRoutes from './routes/workout.routes';
import { startMembershipNotificationScheduler, stopMembershipNotificationScheduler } from './services/membership-notification.service';
import { startWhatsAppWebSession, stopWhatsAppWebSession } from './services/whatsapp-webjs.service';
import { ensureCompleteDemoCatalog, registerRoutineOnboardingListener } from './services/routine-onboarding.service';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const corsOptions = {
  origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    const normalizedOrigin = origin?.replace(/\/+$/, '');

    if (!normalizedOrigin || env.ALLOWED_ORIGINS.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cash-shifts', cashShiftRoutes);
app.use('/api/workouts', workoutRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await testConnection();

    app.listen(env.PORT, () => {
      console.log(`API started on port ${env.PORT} (${env.NODE_ENV})`);
      registerRoutineOnboardingListener();
      void ensureCompleteDemoCatalog().catch((error) => console.error('Error al preparar rutinas demo:', error));
      startWhatsAppWebSession();
      startMembershipNotificationScheduler();
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Cerrando conexiones...`);
  stopMembershipNotificationScheduler();
  await stopWhatsAppWebSession();
  await prisma.$disconnect();
  console.log('Conexiones cerradas');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();








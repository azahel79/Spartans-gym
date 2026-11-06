import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/password.service';

const prisma = new PrismaClient();

const now = Date.now();
const suffix = `workout-smoke-${now}`;

async function main() {
  const trainer = await prisma.user.create({
    data: { email: `${suffix}@trainer.test`, password: await hashPassword('Trainer1234'), role: 'entrenador' },
  });
  const otherTrainer = await prisma.user.create({
    data: { email: `${suffix}-other@trainer.test`, password: await hashPassword('Trainer1234'), role: 'entrenador' },
  });
  const client = await prisma.client.create({
    data: {
      nombre: 'Cliente',
      apellidos: 'Entrenamiento',
      genero: 'Masculino',
      telefono: '+52 5512345678',
      plan: 'Mensual',
      monto: 450,
      metodoPago: 'Efectivo',
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const routine = await prisma.workoutRoutine.create({
    data: {
      trainerId: trainer.id,
      name: 'Rutina smoke profesional',
      level: 'INTERMEDIO',
      objective: 'Validar flujo de rutina',
      durationWeeks: 4,
      daysPerWeek: 1,
      sessionTimeMinutes: 60,
      days: [
        {
          dayName: 'Dia 1',
          focus: 'Full body',
          exercises: [{ name: 'Sentadilla', sets: '4', reps: '10', rest: '90 seg', notes: 'Tecnica controlada' }],
        },
      ],
    },
  });

  const assignment = await prisma.workoutAssignment.create({
    data: {
      routineId: routine.id,
      clientId: client.id,
      trainerId: trainer.id,
      startDate: new Date(),
      clientNotes: 'Asignacion de prueba',
    },
  });

  const loaded = await prisma.workoutAssignment.findUnique({
    where: { id: assignment.id },
    include: { routine: true, client: true, trainer: true },
  });

  if (!loaded) throw new Error('No se pudo cargar la asignacion');
  if (loaded.routine.trainerId !== trainer.id) throw new Error('La rutina no pertenece al entrenador esperado');
  if (loaded.trainerId === otherTrainer.id) throw new Error('La asignacion quedo con entrenador incorrecto');

  await prisma.workoutAssignment.delete({ where: { id: assignment.id } });
  await prisma.workoutRoutine.delete({ where: { id: routine.id } });
  await prisma.client.delete({ where: { id: client.id } });
  await prisma.user.deleteMany({ where: { email: { startsWith: suffix } } });

  console.log('Workout smoke OK');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

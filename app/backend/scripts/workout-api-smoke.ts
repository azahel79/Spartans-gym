import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/password.service';

const prisma = new PrismaClient();
const baseUrl = 'http://localhost:3101/api';
const suffix = `workout-api-${Date.now()}`;

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function login(email: string, password: string) {
  const { response, json } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed ${email}: ${JSON.stringify(json)}`);
  return json.data.token as string;
}

async function main() {
  const password = 'Trainer1234';
  const trainer = await prisma.user.create({
    data: { email: `${suffix}@trainer.test`, password: await hashPassword(password), role: 'entrenador' },
  });
  const otherTrainer = await prisma.user.create({
    data: { email: `${suffix}-other@trainer.test`, password: await hashPassword(password), role: 'entrenador' },
  });
  const receptionist = await prisma.user.create({
    data: { email: `${suffix}@reception.test`, password: await hashPassword(password), role: 'recepcionista' },
  });
  const client = await prisma.client.create({
    data: {
      nombre: 'Cliente',
      apellidos: 'API',
      genero: 'Femenino',
      telefono: '+52 5512345678',
      plan: 'Mensual',
      monto: 450,
      metodoPago: 'Efectivo',
      vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const trainerToken = await login(trainer.email, password);
  const otherToken = await login(otherTrainer.email, password);
  const receptionistToken = await login(receptionist.email, password);

  const denied = await request('/workouts/routines', { headers: { Authorization: `Bearer ${receptionistToken}` } });
  if (denied.response.status !== 403) throw new Error('Recepciónista no fue bloqueado en workouts');

  const created = await request('/workouts/routines', {
    method: 'POST',
    headers: { Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({
      name: 'Rutina API Smoke',
      level: 'PRINCIPIANTE',
      objective: 'Validar API completa',
      durationWeeks: 4,
      daysPerWeek: 1,
      sessionTimeMinutes: 45,
      days: [{
        dayName: 'Dia 1',
        focus: 'Tecnica',
        exercises: [{ name: 'Press banca', sets: '3', reps: '12', rest: '60 seg', notes: 'Controlado' }],
      }],
    }),
  });
  if (!created.response.ok) throw new Error(`No se creo rutina: ${JSON.stringify(created.json)}`);
  const routineId = created.json.data.id as string;

  const forbiddenEdit = await request(`/workouts/routines/${routineId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${otherToken}` },
    body: JSON.stringify({ name: 'Hack' }),
  });
  if (forbiddenEdit.response.status !== 403) {
    throw new Error(`Otro entrenador no recibio 403 al editar rutina ajena. Status=${forbiddenEdit.response.status} Body=${JSON.stringify(forbiddenEdit.json)}`);
  }

  const assigned = await request('/workouts/assignments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({ routineId, clientId: client.id, startDate: new Date().toISOString().slice(0, 10) }),
  });
  if (!assigned.response.ok) throw new Error(`No se asigno rutina: ${JSON.stringify(assigned.json)}`);

  await prisma.workoutAssignment.deleteMany({ where: { routineId } });
  await prisma.workoutRoutine.delete({ where: { id: routineId } });
  await prisma.client.delete({ where: { id: client.id } });
  await prisma.user.deleteMany({ where: { email: { startsWith: suffix } } });

  console.log('Workout API smoke OK');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

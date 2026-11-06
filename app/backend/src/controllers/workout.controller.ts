import { Prisma, WorkoutAssignmentStatus, WorkoutLevel } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { cleanString, parseEnum, parseId, parseInteger, ValidationError } from '../utils/validation';
import { auditLog } from '../services/audit-log.service';
import { isAdminRole } from '../utils/roles';

const LEVELS = ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] as const;
const ASSIGNMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'PAUSED'] as const;

type ExerciseInput = {
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  rest?: unknown;
  notes?: unknown;
};

type RoutineDayInput = {
  dayName?: unknown;
  focus?: unknown;
  exercises?: unknown;
};

function sendError(error: unknown, res: Response, fallback: string) {
  if (error instanceof ValidationError) return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
  console.error(fallback, error);
  return res.status(500).json({ success: false, error: fallback });
}

function parseOptionalDate(value: unknown, field: string) {
  if (!value) return null;
  if (typeof value !== 'string') throw new ValidationError(`${field} debe ser una fecha valida`);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} debe ser una fecha valida`);
  return date;
}

function parseRoutineDays(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('La rutina debe tener al menos un dia de entrenamiento');
  }
  if (value.length > 7) throw new ValidationError('La rutina no puede tener más de 7 días');

  return value.map((day: RoutineDayInput, index) => {
    const dayName = cleanString(day?.dayName, `Día ${index + 1}`, { min: 3, max: 60 });
    const focus = cleanString(day?.focus, `Enfoque del dia ${index + 1}`, { min: 3, max: 90 });
    if (!Array.isArray(day?.exercises) || day.exercises.length === 0) {
      throw new ValidationError(`${dayName} debe incluir al menos un ejercicio`);
    }
    if (day.exercises.length > 14) throw new ValidationError(`${dayName} no puede tener mas de 14 ejercicios`);

    const exercises = day.exercises.map((exercise: ExerciseInput, exerciseIndex) => ({
      name: cleanString(exercise?.name, `Ejercicio ${exerciseIndex + 1}`, { min: 2, max: 90 }),
      sets: cleanString(exercise?.sets, 'Series', { min: 1, max: 20 }),
      reps: cleanString(exercise?.reps, 'Repeticiones', { min: 1, max: 30 }),
      rest: cleanString(exercise?.rest, 'Descanso', { min: 1, max: 30 }),
      notes: cleanString(exercise?.notes, 'Notas del ejercicio', { max: 180, required: false }) || '',
    }));

    return { dayName, focus, exercises };
  });
}

async function resolveTrainerId(req: Request) {
  if (req.user?.role === 'entrenador') return req.user.id;
  const trainerId = parseId(req.body.trainerId, 'Entrenador');
  const trainer = await prisma.user.findUnique({ where: { id: trainerId }, select: { id: true, role: true } });
  if (!trainer || trainer.role !== 'entrenador') throw new ValidationError('Selecciona un entrenador válido');
  return trainerId;
}

async function assertRoutineAccess(routineId: string, req: Request) {
  const routine = await prisma.workoutRoutine.findUnique({ where: { id: routineId } });
  if (!routine) throw new ValidationError('Rutina no encontrada', undefined, 404);
  if (!isAdminRole(req.user?.role) && routine.trainerId !== req.user?.id) {
    throw new ValidationError('No puedes modificar rutinas de otro entrenador', undefined, 403);
  }
  return routine;
}

export async function getWorkoutClients(_req: Request, res: Response) {
  try {
    const clients = await prisma.client.findMany({
      select: { id: true, nombre: true, apellidos: true, telefono: true, plan: true, status: true },
      orderBy: [{ nombre: 'asc' }, { apellidos: 'asc' }],
    });
    return res.json({ success: true, data: clients });
  } catch (error) {
    return sendError(error, res, 'Error al obtener clientes para entrenamiento');
  }
}

export async function getTrainers(_req: Request, res: Response) {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: 'entrenador' },
      select: { id: true, email: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    return res.json({ success: true, data: trainers });
  } catch (error) {
    return sendError(error, res, 'Error al obtener entrenadores');
  }
}

export async function getRoutines(req: Request, res: Response) {
  try {
    const where: Prisma.WorkoutRoutineWhereInput = { isActive: true };
    if (!isAdminRole(req.user?.role)) where.trainerId = req.user?.id;
    if (req.query.level) where.level = parseEnum(req.query.level, 'Nivel', LEVELS) as WorkoutLevel;

    const routines = await prisma.workoutRoutine.findMany({
      where,
      include: {
        trainer: { select: { id: true, email: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ success: true, data: routines });
  } catch (error) {
    return sendError(error, res, 'Error al obtener rutinas');
  }
}

export async function createRoutine(req: Request, res: Response) {
  try {
    const trainerId = await resolveTrainerId(req);
    const routine = await prisma.workoutRoutine.create({
      data: {
        trainerId,
        name: cleanString(req.body.name, 'Nombre de la rutina', { min: 3, max: 100 }),
        level: parseEnum(req.body.level, 'Nivel', LEVELS) as WorkoutLevel,
        objective: cleanString(req.body.objective, 'Objetivo', { min: 3, max: 140 }),
        durationWeeks: parseInteger(req.body.durationWeeks ?? 4, 'Duración', { min: 1, max: 52 }),
        daysPerWeek: parseInteger(req.body.daysPerWeek ?? 3, 'Días por semana', { min: 1, max: 7 }),
        sessionTimeMinutes: req.body.sessionTimeMinutes ? parseInteger(req.body.sessionTimeMinutes, 'Minutos por sesión', { min: 15, max: 240 }) : null,
        notes: cleanString(req.body.notes, 'Notas', { max: 1000, required: false }) || null,
        days: parseRoutineDays(req.body.days),
      },
      include: { trainer: { select: { id: true, email: true } }, _count: { select: { assignments: true } } },
    });
    await auditLog({ req, action: 'WORKOUT_ROUTINE_CREATED', entity: 'WorkoutRoutine', entityId: routine.id, summary: `Rutina creada: ${routine.name}`, metadata: { level: routine.level, trainerId: routine.trainerId } });
    return res.status(201).json({ success: true, data: routine });
  } catch (error) {
    return sendError(error, res, 'Error al crear rutina');
  }
}

export async function updateRoutine(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'Rutina', { min: 10, max: 80 });
    await assertRoutineAccess(id, req);

    const data: Prisma.WorkoutRoutineUpdateInput = {};
    if (req.body.name !== undefined) data.name = cleanString(req.body.name, 'Nombre de la rutina', { min: 3, max: 100 });
    if (req.body.level !== undefined) data.level = parseEnum(req.body.level, 'Nivel', LEVELS) as WorkoutLevel;
    if (req.body.objective !== undefined) data.objective = cleanString(req.body.objective, 'Objetivo', { min: 3, max: 140 });
    if (req.body.durationWeeks !== undefined) data.durationWeeks = parseInteger(req.body.durationWeeks, 'Duración', { min: 1, max: 52 });
    if (req.body.daysPerWeek !== undefined) data.daysPerWeek = parseInteger(req.body.daysPerWeek, 'Días por semana', { min: 1, max: 7 });
    if (req.body.sessionTimeMinutes !== undefined) data.sessionTimeMinutes = req.body.sessionTimeMinutes ? parseInteger(req.body.sessionTimeMinutes, 'Minutos por sesión', { min: 15, max: 240 }) : null;
    if (req.body.notes !== undefined) data.notes = cleanString(req.body.notes, 'Notas', { max: 1000, required: false }) || null;
    if (req.body.days !== undefined) data.days = parseRoutineDays(req.body.days);

    const routine = await prisma.workoutRoutine.update({
      where: { id },
      data,
      include: { trainer: { select: { id: true, email: true } }, _count: { select: { assignments: true } } },
    });
    await auditLog({ req, action: 'WORKOUT_ROUTINE_UPDATED', entity: 'WorkoutRoutine', entityId: routine.id, summary: `Rutina actualizada: ${routine.name}`, metadata: { fields: Object.keys(data) } });
    return res.json({ success: true, data: routine });
  } catch (error) {
    return sendError(error, res, 'Error al actualizar rutina');
  }
}

export async function deleteRoutine(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'Rutina', { min: 10, max: 80 });
    await assertRoutineAccess(id, req);
    const archived = await prisma.workoutRoutine.update({ where: { id }, data: { isActive: false } });
    await auditLog({ req, action: 'WORKOUT_ROUTINE_ARCHIVED', entity: 'WorkoutRoutine', entityId: id, summary: `Rutina archivada: ${archived.name}` });
    return res.json({ success: true, message: 'Rutina archivada correctamente' });
  } catch (error) {
    return sendError(error, res, 'Error al archivar rutina');
  }
}

export async function assignRoutine(req: Request, res: Response) {
  try {
    const routineId = cleanString(req.body.routineId, 'Rutina', { min: 10, max: 80 });
    const clientId = cleanString(req.body.clientId, 'Cliente', { min: 10, max: 80 });
    const routine = await assertRoutineAccess(routineId, req);
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new ValidationError('Cliente no encontrado', undefined, 404);

    const startDate = parseOptionalDate(req.body.startDate, 'Fecha de inicio') ?? new Date();
    const endDate = parseOptionalDate(req.body.endDate, 'Fecha de fin');
    if (endDate && endDate < startDate) throw new ValidationError('La fecha de fin no puede ser anterior a la fecha de inicio');

    const assignment = await prisma.workoutAssignment.create({
      data: {
        routineId,
        clientId,
        trainerId: routine.trainerId,
        startDate,
        endDate,
        clientNotes: cleanString(req.body.clientNotes, 'Notas del cliente', { max: 1000, required: false }) || null,
      },
      include: {
        routine: true,
        client: { select: { id: true, nombre: true, apellidos: true, telefono: true, plan: true, status: true } },
        trainer: { select: { id: true, email: true } },
      },
    });
    await auditLog({ req, action: 'WORKOUT_ASSIGNED', entity: 'WorkoutAssignment', entityId: assignment.id, summary: `Rutina asignada: ${assignment.routine.name} a ${assignment.client.nombre} ${assignment.client.apellidos}`, metadata: { routineId, clientId, trainerId: assignment.trainerId } });
    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    return sendError(error, res, 'Error al asignar rutina');
  }
}

export async function getAssignments(req: Request, res: Response) {
  try {
    const where: Prisma.WorkoutAssignmentWhereInput = {};
    if (!isAdminRole(req.user?.role)) where.trainerId = req.user?.id;
    if (req.query.status) where.status = parseEnum(req.query.status, 'Estado', ASSIGNMENT_STATUSES) as WorkoutAssignmentStatus;
    if (req.query.clientId) where.clientId = cleanString(req.query.clientId, 'Cliente', { min: 10, max: 80 });

    const assignments = await prisma.workoutAssignment.findMany({
      where,
      include: {
        routine: true,
        client: { select: { id: true, nombre: true, apellidos: true, telefono: true, plan: true, status: true } },
        trainer: { select: { id: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ success: true, data: assignments });
  } catch (error) {
    return sendError(error, res, 'Error al obtener asignaciones');
  }
}

export async function updateAssignmentStatus(req: Request, res: Response) {
  try {
    const id = cleanString(req.params.id, 'Asignacion', { min: 10, max: 80 });
    const status = parseEnum(req.body.status, 'Estado', ASSIGNMENT_STATUSES) as WorkoutAssignmentStatus;
    const assignment = await prisma.workoutAssignment.findUnique({ where: { id } });
    if (!assignment) throw new ValidationError('Asignacion no encontrada', undefined, 404);
    if (!isAdminRole(req.user?.role) && assignment.trainerId !== req.user?.id) {
      throw new ValidationError('No puedes modificar asignaciones de otro entrenador', undefined, 403);
    }

    const updated = await prisma.workoutAssignment.update({
      where: { id },
      data: { status },
      include: {
        routine: true,
        client: { select: { id: true, nombre: true, apellidos: true, telefono: true, plan: true, status: true } },
        trainer: { select: { id: true, email: true } },
      },
    });
    await auditLog({ req, action: 'WORKOUT_ASSIGNMENT_STATUS_UPDATED', entity: 'WorkoutAssignment', entityId: updated.id, summary: `Estado de rutina asignada actualizado: ${updated.status}`, metadata: { routineId: updated.routineId, clientId: updated.clientId } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendError(error, res, 'Error al actualizar asignacion');
  }
}

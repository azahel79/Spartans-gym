import fs from 'fs/promises';
import { Genero, Prisma, WorkoutLevel } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { generateWorkoutAssignmentPdf } from './workout-pdf.service';
import { registerWhatsAppWebMessageHandler, sendWhatsAppWebDocument, sendWhatsAppWebMessage } from './whatsapp-webjs.service';

type OnboardingClient = {
  id: string;
  nombre: string;
  apellidos: string;
  genero: Genero;
  telefono: string;
  whatsappOptIn: boolean;
  vencimiento: Date;
  workoutAssignments?: Array<{ id: string; routine: { name: string; level: WorkoutLevel } }>;
};

type RoutineOption = {
  id: string;
  name: string;
  objective: string;
  durationWeeks: number;
  daysPerWeek: number;
  sessionTimeMinutes: number | null;
  trainer?: { email: string } | null;
};

type PendingStep = 'LEVEL' | 'ROUTINE_SELECTION';

type PendingState = {
  clientId: string;
  promptedAt: number;
  step: PendingStep;
  level?: WorkoutLevel;
  routineIds?: string[];
};

const promptedPhones = new Map<string, number>();
const pendingClientsByPhone = new Map<string, PendingState>();
const PROMPT_TTL_MS = 1000 * 60 * 60 * 12;
const ROUTINE_OPTION_COUNT = 3;

const levelLabels: Record<WorkoutLevel, string> = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

function normalizePhone(phone: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `${env.WHATSAPP_DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.startsWith('521') && digits.length === 13) digits = `52${digits.slice(3)}`;
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

function phoneVariants(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.startsWith('52') && normalized.length === 12) variants.add(`521${normalized.slice(2)}`);
  if (normalized.startsWith('521') && normalized.length === 13) variants.add(`52${normalized.slice(3)}`);
  return [...variants];
}

function rememberPendingState(phone: string, state: Omit<PendingState, 'promptedAt'>) {
  const promptedAt = Date.now();
  for (const variant of phoneVariants(phone)) {
    promptedPhones.set(variant, promptedAt);
    pendingClientsByPhone.set(variant, { ...state, promptedAt });
  }
}

function clearPendingClient(phone: string) {
  for (const variant of phoneVariants(phone)) {
    promptedPhones.delete(variant);
    pendingClientsByPhone.delete(variant);
  }
}

function getPendingState(phone: string, extraCandidates: string[] = []) {
  const variants = new Set([phone, ...extraCandidates].flatMap((candidate) => phoneVariants(candidate)));
  for (const variant of variants) {
    const pending = pendingClientsByPhone.get(variant);
    if (pending && Date.now() - pending.promptedAt < PROMPT_TTL_MS) return pending;
  }
  return null;
}

function getRecentSinglePendingClientId() {
  const now = Date.now();
  const recent = [...pendingClientsByPhone.values()].filter((item) => now - item.promptedAt < PROMPT_TTL_MS);
  const uniqueIds = [...new Set(recent.map((item) => item.clientId))];
  return uniqueIds.length === 1 ? uniqueIds[0] : null;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseLevelAnswer(body: string): WorkoutLevel | null {
  const compact = normalizeText(body).replace(/[^a-z0-9]/g, '');

  if (compact === '1' || compact.includes('principiante') || compact.includes('basico')) return 'PRINCIPIANTE';
  if (compact === '2' || compact.includes('intermedio') || compact.includes('medio')) return 'INTERMEDIO';
  if (compact === '3' || compact.includes('avanzado') || compact.includes('experto')) return 'AVANZADO';
  return null;
}

function parseNumericChoice(body: string, max: number) {
  const value = Number(normalizeText(body).replace(/[^0-9]/g, ''));
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
}

function buildLevelPrompt(name: string, invalid = false) {
  const intro = invalid
    ? `Necesito que elijas una opción válida para preparar tus rutinas, ${name}.`
    : `Antes de mostrarte tus rutinas recomendadas, dime en qué nivel te consideras dentro del mundo del gym, ${name}.`;

  return `${intro}\n\nResponde solo con el número:\n\n1. Principiante\n2. Intermedio\n3. Avanzado`;
}

function trainerDisplayName(email?: string | null) {
  if (!email) return 'Entrenador disponible';
  const local = email.split('@')[0] || email;
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email;
}

function buildRoutineOptionsMessage(client: OnboardingClient, level: WorkoutLevel, routines: RoutineOption[], invalid = false) {
  const header = invalid
    ? `Elige una opción válida para asignarte una rutina, ${client.nombre}.`
    : `${client.nombre}, estas son tus rutinas recomendadas según tu nivel ${levelLabels[level]} y tu perfil.`;

  const options = routines.map((routine, index) => {
    const duration = `${routine.durationWeeks} semanas, ${routine.daysPerWeek} días/semana`;
    const session = routine.sessionTimeMinutes ? `, ${routine.sessionTimeMinutes} min por sesión` : '';
    return `${index + 1}. ${routine.name}\n   Entrenador: ${trainerDisplayName(routine.trainer?.email)}\n   ${duration}${session}\n   Objetivo: ${routine.objective}`;
  });

  return `${header}\n\n${options.join('\n\n')}\n\nResponde solo con el número de la rutina que prefieres.`;
}

function genderKeywords(gender: Genero) {
  if (gender === 'Femenino') return ['femenino', 'mujer', 'mujeres', 'dama', 'damas', 'gluteo', 'gluteos'];
  if (gender === 'Masculino') return ['masculino', 'hombre', 'hombres', 'varon', 'varones'];
  return [];
}

function routineScore(routine: { name: string; objective: string; notes: string | null }, gender: Genero) {
  const text = normalizeText(`${routine.name} ${routine.objective} ${routine.notes || ''}`);
  let score = 0;

  for (const keyword of genderKeywords(gender)) {
    if (text.includes(keyword)) score += 10;
  }

  const oppositeGender = gender === 'Femenino' ? 'Masculino' : gender === 'Masculino' ? 'Femenino' : 'Otro';
  for (const keyword of genderKeywords(oppositeGender)) {
    if (text.includes(keyword)) score -= 10;
  }

  if (text.includes('general')) score += 2;
  if (text.includes('demo profesional') || text.includes('whatsapp demo')) score += 4;
  return score;
}

function exercise(name: string, sets: string, reps: string, rest = '60 seg', notes = '') {
  return { name, sets, reps, rest, notes };
}

function levelVolume(level: WorkoutLevel) {
  if (level === 'AVANZADO') return { mainSets: '4', accessorySets: '4', reps: '8-10', rest: '75-90 seg', weeks: 6, minutes: 75 };
  if (level === 'INTERMEDIO') return { mainSets: '4', accessorySets: '3', reps: '10-12', rest: '60-75 seg', weeks: 5, minutes: 65 };
  return { mainSets: '3', accessorySets: '3', reps: '12-15', rest: '60 seg', weeks: 4, minutes: 55 };
}

function coachingNotes(level: WorkoutLevel, focus: string) {
  const effort = level === 'AVANZADO' ? 'RPE 8-9, dejando 1-2 repeticiones en reserva' : level === 'INTERMEDIO' ? 'RPE 7-8, dejando 2 repeticiones en reserva' : 'RPE 6-7, técnica perfecta antes de subir peso';
  const progression = level === 'AVANZADO'
    ? 'Progresión: aumenta 2.5-5% la carga cuando completes todas las series en el rango alto. Semana 4 descarga activa al 80% del volumen.'
    : level === 'INTERMEDIO'
      ? 'Progresión: cuando completes el rango alto de repeticiones, sube carga ligera la siguiente sesión. Semana 5 consolida técnica y marcas.'
      : 'Progresión: primero domina rango de movimiento y respiración. Sube carga solo si no pierdes postura.';

  return [
    `Objetivo técnico: ${focus}.`,
    `Intensidad: ${effort}.`,
    progression,
    'Calentamiento: 6-8 min de cardio suave, movilidad de cadera/hombro y 2 series de aproximación del primer ejercicio.',
    'Indicaciones: controla la fase excéntrica, evita dolor articular y registra pesos para medir progreso.',
    'Enfriamiento: respiración 2 min y estiramiento ligero de los grupos trabajados.',
  ].join('\n');
}

function routinePlan(level: WorkoutLevel, gender: Genero, variant: number): { name: string; objective: string; days: Prisma.InputJsonValue; notes: string } {
  const volume = levelVolume(level);
  const genderLabel = gender === 'Otro' ? 'General' : gender;
  const levelLabel = levelLabels[level];
  const cardio = level === 'AVANZADO' ? '12-15 min por intervalos 40/80' : level === 'INTERMEDIO' ? '12-15 min moderado' : '10-12 min suave';

  if (gender === 'Femenino') {
    if (variant === 1) {
      return {
        name: `Demo Profesional ${levelLabel} Femenino - Glúteo y Pierna`,
        objective: 'Desarrollar glúteo, pierna y estabilidad lumbopélvica con progresión controlada y técnica segura.',
        notes: coachingNotes(level, 'priorizar glúteo mayor, femoral y control de rodilla sin descuidar postura'),
        days: [
          { dayName: 'Día 1', focus: 'Glúteo dominante y técnica de bisagra', exercises: [
            exercise('Hip thrust con pausa arriba', volume.mainSets, volume.reps, volume.rest, 'Pausa 2 seg en contracción, barbilla neutra, pelvis estable.'),
            exercise('Peso muerto rumano con mancuernas', volume.mainSets, '10-12', volume.rest, 'Baja hasta sentir femoral, espalda neutra, mancuernas cerca del cuerpo.'),
            exercise('Abducción en máquina o banda', volume.accessorySets, '15-20', '45 seg', 'No rebotes; abre con control y mantén tensión continua.'),
            exercise('Plancha frontal con respiración', '3', '35-45 seg', '45 seg', 'Costillas abajo, abdomen activo, sin hundir lumbar.'),
          ] },
          { dayName: 'Día 2', focus: 'Torso, postura y cintura escapular', exercises: [
            exercise('Jalón al pecho agarre neutro', volume.mainSets, volume.reps, volume.rest, 'Lleva codos hacia costillas, no tires con cuello.'),
            exercise('Press inclinado con mancuernas', volume.accessorySets, '10-12', volume.rest, 'Escápulas firmes, recorrido cómodo, muñecas alineadas.'),
            exercise('Remo sentado con pausa', volume.accessorySets, '12', volume.rest, 'Pausa 1 seg atrás, pecho alto, evita balanceo.'),
            exercise('Face pull', '3', '15', '45 seg', 'Codos altos, termina con manos cerca de orejas.'),
          ] },
          { dayName: 'Día 3', focus: 'Pierna completa y acondicionamiento', exercises: [
            exercise('Prensa inclinada pies medios-altos', volume.mainSets, volume.reps, volume.rest, 'Rodillas siguen línea de pies, no bloquees al subir.'),
            exercise('Sentadilla búlgara asistida', volume.accessorySets, '10 por pierna', volume.rest, 'Tronco ligeramente inclinado, empuja desde talón.'),
            exercise('Curl femoral sentado o acostado', volume.accessorySets, '12-15', '60 seg', 'Controla el regreso 2-3 seg.'),
            exercise('Caminata inclinada', '1', cardio, '-', 'Ritmo sostenible; termina con respiración controlada.'),
          ] },
        ],
      };
    }
    if (variant === 2) {
      return {
        name: `Demo Profesional ${levelLabel} Femenino - Full Body Tonificación`,
        objective: 'Mejorar composición corporal, tono muscular y resistencia con sesiones completas y balanceadas.',
        notes: coachingNotes(level, 'estimular todo el cuerpo con énfasis en postura, core y gasto calórico'),
        days: [
          { dayName: 'Día 1', focus: 'Full body fuerza técnica', exercises: [
            exercise('Sentadilla goblet a caja', volume.mainSets, volume.reps, volume.rest, 'Usa caja como referencia, controla rodillas y profundidad.'),
            exercise('Press de pecho en máquina', volume.accessorySets, '10-12', volume.rest, 'No eleves hombros; empuja parejo con ambos brazos.'),
            exercise('Remo con cable agarre cerrado', volume.accessorySets, '12', volume.rest, 'Pecho alto y pausa breve al final.'),
            exercise('Dead bug contralateral', '3', '10-12 por lado', '45 seg', 'Lumbar pegada al piso; movimiento lento.'),
          ] },
          { dayName: 'Día 2', focus: 'Metabólico controlado y pierna unilateral', exercises: [
            exercise('Peso muerto con kettlebell', volume.mainSets, '12', volume.rest, 'Bisagra de cadera, no sentadilla; cuello relajado.'),
            exercise('Step up al cajón', volume.accessorySets, '10 por pierna', '60 seg', 'Sube empujando con pierna de arriba; baja controlado.'),
            exercise('Press militar con mancuernas', volume.accessorySets, '10-12', volume.rest, 'Abdomen firme, sin arquear lumbar.'),
            exercise('Bicicleta estática', '1', cardio, '-', 'Mantén cadencia constante; no debe impedir hablar frases cortas.'),
          ] },
          { dayName: 'Día 3', focus: 'Glúteo, core y espalda saludable', exercises: [
            exercise('Hip thrust unilateral', volume.accessorySets, '10 por pierna', volume.rest, 'Cadera nivelada, pausa arriba, controla bajada.'),
            exercise('Jalón agarre neutro', volume.mainSets, volume.reps, volume.rest, 'Codos hacia abajo, hombros lejos de orejas.'),
            exercise('Extensión lumbar en banco', '3', '12', '60 seg', 'Sube hasta línea del cuerpo, no hiperextiendas.'),
            exercise('Pallof press', '3', '12 por lado', '45 seg', 'Resiste rotación, exhala al extender brazos.'),
          ] },
        ],
      };
    }
    return {
      name: `Demo Profesional ${levelLabel} Femenino - Definición y Core`,
      objective: 'Aumentar gasto calórico, preservar músculo y fortalecer abdomen con trabajo inteligente de fuerza.',
      notes: coachingNotes(level, 'combinar fuerza, core anti-rotación y cardio sin sacrificar técnica'),
      days: [
        { dayName: 'Día 1', focus: 'Tren inferior, glúteo y abdomen', exercises: [
          exercise('Sentadilla búlgara', volume.accessorySets, '10 por pierna', volume.rest, 'Rodilla estable; usa apoyo si pierdes equilibrio.'),
          exercise('Hip thrust', volume.mainSets, volume.reps, volume.rest, 'Empuja con talones y no sobreextiendas lumbar.'),
          exercise('Crunch en polea', '3', '12-15', '45 seg', 'Flexiona columna con control, no jales con brazos.'),
          exercise('Elíptica', '1', cardio, '-', 'Zona moderada, respiración constante.'),
        ] },
        { dayName: 'Día 2', focus: 'Torso activo y postura', exercises: [
          exercise('Remo sentado', volume.mainSets, volume.reps, volume.rest, 'Pausa atrás, omóplatos juntos.'),
          exercise('Press hombro sentado', volume.accessorySets, '10-12', volume.rest, 'Evita arquear espalda; rango cómodo.'),
          exercise('Curl bíceps + tríceps cuerda', '3', '12 + 12', '45 seg', 'Superserie; controla ambos movimientos.'),
          exercise('Mountain climbers lentos', '3', '30 seg', '45 seg', 'Cadera estable, rodillas al pecho sin brincar.'),
        ] },
        { dayName: 'Día 3', focus: 'Circuito técnico de cuerpo completo', exercises: [
          exercise('Prensa', volume.mainSets, '12', volume.rest, 'Tempo 2-0-2; no bloquees rodillas.'),
          exercise('Jalón al pecho', volume.accessorySets, '12', volume.rest, 'Codos bajan primero, pecho alto.'),
          exercise('Peso muerto rumano', volume.accessorySets, '10-12', volume.rest, 'Siente femoral, espalda neutral.'),
          exercise('Caminata inclinada', '1', cardio, '-', 'Termina fuerte pero sin perder respiración.'),
        ] },
      ],
    };
  }

  if (gender === 'Masculino') {
    if (variant === 1) {
      return {
        name: `Demo Profesional ${levelLabel} Masculino - Fuerza Base`,
        objective: 'Construir fuerza técnica en sentadilla, empuje y jalón con progresión medible y segura.',
        notes: coachingNotes(level, 'consolidar patrones básicos de fuerza antes de perseguir cargas máximas'),
        days: [
          { dayName: 'Día 1', focus: 'Sentadilla y empuje horizontal', exercises: [
            exercise('Sentadilla trasera o goblet', volume.mainSets, volume.reps, volume.rest, 'Brace abdominal antes de bajar; rodillas alineadas.'),
            exercise('Press banca o máquina', volume.mainSets, volume.reps, volume.rest, 'Escápulas retraídas, pies firmes, controla bajada.'),
            exercise('Fondos asistidos o press cerrado', volume.accessorySets, '10-12', '60 seg', 'Codos cerca del cuerpo, sin dolor de hombro.'),
            exercise('Plancha con reach', '3', '30-40 seg', '45 seg', 'Evita rotar cadera al extender brazo.'),
          ] },
          { dayName: 'Día 2', focus: 'Cadena posterior y espalda', exercises: [
            exercise('Peso muerto rumano', volume.mainSets, '8-12', volume.rest, 'Barra cerca de piernas, cadera atrás, espalda neutra.'),
            exercise('Jalón al pecho', volume.mainSets, volume.reps, volume.rest, 'No balancees; pausa abajo 1 seg.'),
            exercise('Remo con barra o cable', volume.accessorySets, '10-12', volume.rest, 'Tira con codos, no con manos.'),
            exercise('Curl femoral', '3', '12', '60 seg', 'Regreso lento, controla la cadera.'),
          ] },
          { dayName: 'Día 3', focus: 'Full body fuerza estructural', exercises: [
            exercise('Prensa o sentadilla frontal', volume.mainSets, '10-12', volume.rest, 'Rango completo sin despegar cadera.'),
            exercise('Press militar', volume.mainSets, volume.reps, volume.rest, 'Glúteo y abdomen firmes; no hiperextiendas.'),
            exercise('Curl bíceps inclinado', volume.accessorySets, '12', '45 seg', 'Codos fijos, recorrido completo.'),
            exercise('Tríceps cuerda', volume.accessorySets, '12', '45 seg', 'Abre cuerda al final, hombros quietos.'),
          ] },
        ],
      };
    }
    if (variant === 2) {
      return {
        name: `Demo Profesional ${levelLabel} Masculino - Hipertrofia Torso Pierna`,
        objective: 'Ganar masa muscular con volumen efectivo, técnica sólida y distribución torso-pierna.',
        notes: coachingNotes(level, 'acumular volumen de hipertrofia sin comprometer recuperación ni articulaciones'),
        days: [
          { dayName: 'Día 1', focus: 'Torso hipertrofia', exercises: [
            exercise('Press banca inclinado', volume.mainSets, volume.reps, volume.rest, 'Baja 2 seg, empuja explosivo sin rebotar.'),
            exercise('Remo sentado pesado', volume.mainSets, '10-12', volume.rest, 'Pausa atrás, tronco estable.'),
            exercise('Elevaciones laterales', volume.accessorySets, '15-20', '45 seg', 'Lidera con codos, sin impulso.'),
            exercise('Curl bíceps barra Z', volume.accessorySets, '10-12', '45 seg', 'Muñecas neutrales, extensión completa.'),
          ] },
          { dayName: 'Día 2', focus: 'Pierna hipertrofia', exercises: [
            exercise('Sentadilla o prensa pesada', volume.mainSets, volume.reps, volume.rest, 'Últimas reps retadoras, sin perder profundidad.'),
            exercise('Peso muerto rumano', volume.mainSets, '8-10', volume.rest, 'Enfoca femoral; no conviertas en sentadilla.'),
            exercise('Extensión de cuádriceps', volume.accessorySets, '12-15', '60 seg', 'Pausa arriba 1 seg, baja controlado.'),
            exercise('Gemelo de pie', '4', '12-15', '45 seg', 'Pausa arriba y estira abajo.'),
          ] },
          { dayName: 'Día 3', focus: 'Torso complemento y brazos', exercises: [
            exercise('Jalón al pecho agarre abierto', volume.mainSets, volume.reps, volume.rest, 'Pecho alto, hombros abajo.'),
            exercise('Press militar mancuernas', volume.accessorySets, '10-12', volume.rest, 'Controla rango y evita dolor.'),
            exercise('Aperturas en máquina', volume.accessorySets, '12-15', '60 seg', 'Estira pecho sin forzar hombro.'),
            exercise('Tríceps cuerda + curl martillo', '3', '12 + 12', '45 seg', 'Superserie limpia, sin balanceo.'),
          ] },
        ],
      };
    }
    return {
      name: `Demo Profesional ${levelLabel} Masculino - Definición Atlética`,
      objective: 'Reducir grasa, sostener fuerza y elevar condición cardiovascular con trabajo atlético progresivo.',
      notes: coachingNotes(level, 'mantener fuerza mientras se incrementa densidad de entrenamiento y condición'),
      days: [
        { dayName: 'Día 1', focus: 'Fuerza metabólica', exercises: [
          exercise('Sentadilla frontal o goblet', volume.mainSets, '10-12', volume.rest, 'Tronco vertical, abdomen firme.'),
          exercise('Press banca', volume.mainSets, '8-10', volume.rest, 'Carga retadora con técnica limpia.'),
          exercise('Remo con cable', volume.accessorySets, '12', '60 seg', 'Pausa atrás, sin balanceo.'),
          exercise('Caminadora intervalos', '1', cardio, '-', 'Alterna rápido/suave según tolerancia.'),
        ] },
        { dayName: 'Día 2', focus: 'Espalda, posterior y core', exercises: [
          exercise('Dominadas asistidas o jalón', volume.mainSets, volume.reps, volume.rest, 'Recorrido completo, sin impulso.'),
          exercise('Peso muerto rumano', volume.mainSets, '10', volume.rest, 'Controla excéntrica 3 seg.'),
          exercise('Plancha lateral', '3', '30-40 seg por lado', '45 seg', 'Cadera alta, costillas abajo.'),
          exercise('Bicicleta', '1', cardio, '-', 'Mantén cadencia y postura.'),
        ] },
        { dayName: 'Día 3', focus: 'Full body acondicionamiento', exercises: [
          exercise('Prensa', volume.mainSets, '12', volume.rest, 'No bloquees; tensión constante.'),
          exercise('Press militar', volume.accessorySets, '10-12', volume.rest, 'Respira y bloquea core.'),
          exercise('Curl + tríceps en superserie', '3', '12 + 12', '45 seg', 'Transición rápida, técnica limpia.'),
          exercise('Remo ergómetro', '1', '10-12 min', '-', 'Ritmo fuerte sostenible.'),
        ] },
      ],
    };
  }

  return {
    name: `Demo Profesional ${levelLabel} General - Full Body Integral ${variant}`,
    objective: 'Mejorar fuerza general, técnica, movilidad y condición física con una estructura balanceada.',
    notes: coachingNotes(level, `perfil ${genderLabel.toLowerCase()} con enfoque general adaptable y progresión segura`),
    days: [
      { dayName: 'Día 1', focus: 'Full body base', exercises: [
        exercise('Sentadilla guiada', volume.mainSets, volume.reps, volume.rest, 'Controla profundidad y rodillas alineadas.'),
        exercise('Press de pecho', volume.accessorySets, '10-12', volume.rest, 'Escápulas firmes, rango cómodo.'),
        exercise('Jalón al pecho', volume.accessorySets, '12', volume.rest, 'Codos hacia costillas, sin impulso.'),
        exercise('Plancha', '3', '35-45 seg', '45 seg', 'Abdomen activo y respiración estable.'),
      ] },
      { dayName: 'Día 2', focus: 'Pierna, espalda y postura', exercises: [
        exercise('Prensa', volume.mainSets, '10-12', volume.rest, 'Tempo controlado 2-0-2.'),
        exercise('Peso muerto rumano', volume.accessorySets, '10-12', volume.rest, 'Bisagra limpia, espalda neutra.'),
        exercise('Remo sentado', volume.accessorySets, '12', volume.rest, 'Pausa atrás 1 seg.'),
        exercise('Caminata inclinada', '1', cardio, '-', 'Termina con respiración controlada.'),
      ] },
      { dayName: 'Día 3', focus: 'Acondicionamiento y core', exercises: [
        exercise('Step up', volume.accessorySets, '10 por pierna', '60 seg', 'Sube con control, no impulses con pierna de abajo.'),
        exercise('Press hombro', volume.accessorySets, '12', volume.rest, 'Core firme, cuello relajado.'),
        exercise('Pallof press', '3', '12 por lado', '45 seg', 'Resiste rotación, exhala al extender.'),
        exercise('Bicicleta', '1', cardio, '-', 'Ritmo medio y constante.'),
      ] },
    ],
  };
}
async function findAvailableTrainerIds() {
  const trainers = await prisma.user.findMany({
    where: { role: 'entrenador' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (trainers.length > 0) return trainers.map((trainer) => trainer.id);

  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'superadmin'] } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return admins.map((admin) => admin.id);
}

async function ensureDemoRoutines(level: WorkoutLevel, gender: Genero) {
  const trainerIds = await findAvailableTrainerIds();
  if (trainerIds.length === 0) throw new Error('No hay entrenadores o administradores disponibles para crear rutinas demo');

  for (let variant = 1; variant <= ROUTINE_OPTION_COUNT; variant += 1) {
    const plan = routinePlan(level, gender, variant);
    const existing = await prisma.workoutRoutine.findFirst({ where: { name: plan.name, level, isActive: true }, select: { id: true } });
    const planDays = Array.isArray(plan.days) ? plan.days.length : 3;
    const routineData = {
      trainerId: trainerIds[(variant - 1) % trainerIds.length],
      name: plan.name,
      level,
      objective: plan.objective,
      durationWeeks: levelVolume(level).weeks,
      daysPerWeek: planDays,
      sessionTimeMinutes: levelVolume(level).minutes,
      notes: plan.notes,
      days: plan.days,
    };

    if (existing) {
      await prisma.workoutRoutine.update({
        where: { id: existing.id },
        data: routineData,
      });
      continue;
    }

    await prisma.workoutRoutine.create({
      data: routineData,
    });
  }
}

export async function ensureCompleteDemoCatalog() {
  await prisma.workoutRoutine.updateMany({
    where: {
      name: { startsWith: 'Rutina demo' },
      isActive: true,
    },
    data: { isActive: false },
  });

  const levels: WorkoutLevel[] = ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'];
  const genders: Genero[] = ['Masculino', 'Femenino', 'Otro'];

  for (const gender of genders) {
    for (const level of levels) {
      await ensureDemoRoutines(level, gender);
    }
  }
}

async function getRoutineOptions(level: WorkoutLevel, gender: Genero): Promise<RoutineOption[]> {
  await ensureDemoRoutines(level, gender);

  const routines = await prisma.workoutRoutine.findMany({
    where: { level, isActive: true },
    include: { trainer: { select: { email: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return routines
    .map((routine) => ({ routine, score: routineScore(routine, gender) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ROUTINE_OPTION_COUNT)
    .map(({ routine }) => ({
      id: routine.id,
      name: routine.name,
      objective: routine.objective,
      durationWeeks: routine.durationWeeks,
      daysPerWeek: routine.daysPerWeek,
      sessionTimeMinutes: routine.sessionTimeMinutes,
      trainer: routine.trainer,
    }));
}

async function assignSelectedRoutine(client: OnboardingClient, routineId: string, level: WorkoutLevel) {
  const existing = await prisma.workoutAssignment.findFirst({
    where: { clientId: client.id, status: 'ACTIVE' },
    include: { routine: true, trainer: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  const routine = await prisma.workoutRoutine.findFirst({
    where: { id: routineId, level, isActive: true },
    include: { trainer: { select: { email: true } } },
  });
  if (!routine) throw new Error('La rutina seleccionada ya no está disponible');

  return prisma.workoutAssignment.create({
    data: {
      routineId: routine.id,
      clientId: client.id,
      trainerId: routine.trainerId,
      startDate: new Date(),
      endDate: client.vencimiento,
      clientNotes: `Asignación automática por WhatsApp demo. Nivel: ${levelLabels[level]}. Rutina elegida por el cliente.`,
    },
    include: { routine: true, trainer: { select: { email: true } } },
  });
}

async function getClientForOnboarding(clientId: string): Promise<OnboardingClient | null> {
  return prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      genero: true,
      telefono: true,
      whatsappOptIn: true,
      vencimiento: true,
      workoutAssignments: {
        where: { status: 'ACTIVE' },
        take: 1,
        select: { id: true, routine: { select: { name: true, level: true } } },
      },
    },
  });
}

async function findClientByIncomingPhone(phone: string, extraCandidates: string[] = []): Promise<OnboardingClient | null> {
  const pending = getPendingState(phone, extraCandidates);
  if (pending) return getClientForOnboarding(pending.clientId);

  const incomingVariants = new Set([phone, ...extraCandidates].flatMap((candidate) => phoneVariants(candidate)));
  if (incomingVariants.size === 0) {
    const pendingClientId = getRecentSinglePendingClientId();
    return pendingClientId ? getClientForOnboarding(pendingClientId) : null;
  }

  const clients = await prisma.client.findMany({
    where: { whatsappOptIn: true },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      genero: true,
      telefono: true,
      whatsappOptIn: true,
      vencimiento: true,
      workoutAssignments: {
        where: { status: 'ACTIVE' },
        take: 1,
        select: { id: true, routine: { select: { name: true, level: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return clients.find((client) => phoneVariants(client.telefono).some((variant) => incomingVariants.has(variant))) || null;
}

async function sendRoutineOptions(client: OnboardingClient, recipient: string, level: WorkoutLevel, invalid = false) {
  const routines = await getRoutineOptions(level, client.genero);
  await sendWhatsAppWebMessage(recipient, buildRoutineOptionsMessage(client, level, routines, invalid));
  rememberPendingState(recipient, { clientId: client.id, step: 'ROUTINE_SELECTION', level, routineIds: routines.map((routine) => routine.id) });
}

export async function promptRoutineLevelForClient(clientId: string, delayMs = 3500) {
  if (!env.WHATSAPP_ENABLED || env.WHATSAPP_PROVIDER !== 'webjs') return;

  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      whatsappOptIn: true,
      workoutAssignments: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
    },
  });

  if (!client?.whatsappOptIn || client.workoutAssignments.length > 0) return;

  const recipient = normalizePhone(client.telefono);
  if (!recipient) return;

  const lastPromptAt = promptedPhones.get(recipient) || 0;
  if (Date.now() - lastPromptAt < PROMPT_TTL_MS) return;

  await sendWhatsAppWebMessage(recipient, buildLevelPrompt(client.nombre));
  rememberPendingState(recipient, { clientId: client.id, step: 'LEVEL' });
}

export function registerRoutineOnboardingListener() {
  registerWhatsAppWebMessageHandler(async ({ from, fromCandidates, body }) => {
    const client = await findClientByIncomingPhone(from, fromCandidates);
    if (!client || !client.whatsappOptIn) return;

    const recipient = normalizePhone(client.telefono);
    if (!recipient) return;

    const activeAssignment = client.workoutAssignments?.[0];
    if (activeAssignment) {
      await sendWhatsAppWebMessage(recipient, `Ya tienes asignada la rutina "${activeAssignment.routine.name}". Puedes revisarla en recepción para generar tu PDF o pedir ajustes al entrenador.`);
      clearPendingClient(recipient);
      return;
    }

    const pending = getPendingState(from, fromCandidates);

    if (pending?.step === 'ROUTINE_SELECTION' && pending.level && pending.routineIds?.length) {
      const choice = parseNumericChoice(body, pending.routineIds.length);
      if (!choice) {
        const routines = await prisma.workoutRoutine.findMany({
          where: { id: { in: pending.routineIds }, isActive: true },
          include: { trainer: { select: { email: true } } },
        });
        const ordered = pending.routineIds
          .map((id) => routines.find((routine) => routine.id === id))
          .filter((routine): routine is NonNullable<typeof routine> => Boolean(routine))
          .map((routine) => ({
            id: routine.id,
            name: routine.name,
            objective: routine.objective,
            durationWeeks: routine.durationWeeks,
            daysPerWeek: routine.daysPerWeek,
            sessionTimeMinutes: routine.sessionTimeMinutes,
            trainer: routine.trainer,
          }));
        await sendWhatsAppWebMessage(recipient, buildRoutineOptionsMessage(client, pending.level, ordered, true));
        rememberPendingState(recipient, { clientId: client.id, step: 'ROUTINE_SELECTION', level: pending.level, routineIds: pending.routineIds });
        return;
      }

      const routineId = pending.routineIds[choice - 1];
      const assignment = await assignSelectedRoutine(client, routineId, pending.level);
      await sendWhatsAppWebMessage(
        recipient,
        `Perfecto, ${client.nombre}. Te asignamos la rutina "${assignment.routine.name}".\n\nEntrenador: ${trainerDisplayName(assignment.trainer?.email)}\nNivel: ${levelLabels[pending.level]}\n\nYa quedó reflejada en el sistema. Enseguida te mando tu PDF para que puedas seguirla.`
      );

      const pdf = await generateWorkoutAssignmentPdf(assignment.id);
      try {
        await sendWhatsAppWebDocument(recipient, pdf.filePath, `Rutina personalizada - ${assignment.routine.name}`);
      } finally {
        await fs.unlink(pdf.filePath).catch(() => undefined);
      }

      clearPendingClient(recipient);
      return;
    }

    const level = parseLevelAnswer(body);
    if (!level) {
      await sendWhatsAppWebMessage(recipient, buildLevelPrompt(client.nombre, true));
      rememberPendingState(recipient, { clientId: client.id, step: 'LEVEL' });
      return;
    }

    await sendRoutineOptions(client, recipient, level);
  });
}





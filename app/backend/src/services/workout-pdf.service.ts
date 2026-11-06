import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { prisma } from '../config/database';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const LINE_HEIGHT = 15;

const levelLabel: Record<string, string> = {
  PRINCIPIANTE: 'Principiante',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  color?: [number, number, number];
  gapBefore?: number;
};

function safeFile(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function ascii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function escapePdfText(value: string) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'No definida';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No definida';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function parseDays(value: unknown): Array<{ dayName: string; focus: string; exercises: Array<{ name: string; sets: string; reps: string; rest: string; notes?: string }> }> {
  if (!Array.isArray(value)) return [];
  return value.map((day, index) => {
    const current = day && typeof day === 'object' ? day as Record<string, unknown> : {};
    const exercises = Array.isArray(current.exercises) ? current.exercises : [];
    return {
      dayName: String(current.dayName || `Dia ${index + 1}`),
      focus: String(current.focus || 'Entrenamiento'),
      exercises: exercises.map((exercise) => {
        const item = exercise && typeof exercise === 'object' ? exercise as Record<string, unknown> : {};
        return {
          name: String(item.name || 'Ejercicio'),
          sets: String(item.sets || '-'),
          reps: String(item.reps || '-'),
          rest: String(item.rest || '-'),
          notes: item.notes ? String(item.notes) : '',
        };
      }),
    };
  });
}

function line(text: string, options: Omit<PdfLine, 'text'> = {}): PdfLine {
  return { text, ...options };
}

function buildLines(input: {
  gymName: string;
  gymPhone?: string | null;
  gymEmail?: string | null;
  clientName: string;
  trainerName: string;
  routine: {
    name: string;
    level: string;
    objective: string;
    durationWeeks: number;
    daysPerWeek: number;
    sessionTimeMinutes: number | null;
    notes: string | null;
    days: unknown;
  };
  startDate: Date;
  endDate: Date | null;
  clientNotes: string | null;
}) {
  const primary: [number, number, number] = [214, 0, 0];
  const dark: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [71, 85, 105];
  const lines: PdfLine[] = [];

  lines.push(line(input.gymName.toUpperCase(), { size: 22, bold: true, color: primary }));
  lines.push(line('PLAN DE ENTRENAMIENTO PERSONALIZADO', { size: 12, bold: true, color: dark }));
  if (input.gymPhone || input.gymEmail) lines.push(line([input.gymPhone, input.gymEmail].filter(Boolean).join(' | '), { size: 9, color: muted }));
  lines.push(line(`Generado: ${formatDate(new Date())}`, { size: 9, color: muted }));

  lines.push(line(input.routine.name, { size: 18, bold: true, color: dark, gapBefore: 18 }));
  for (const wrapped of wrapText(input.routine.objective || 'Objetivo no definido', 82)) lines.push(line(wrapped, { size: 10, color: muted }));

  lines.push(line('Datos del plan', { size: 13, bold: true, color: primary, gapBefore: 16 }));
  lines.push(line(`Cliente: ${input.clientName}`, { size: 10 }));
  lines.push(line(`Entrenador: ${input.trainerName}`, { size: 10 }));
  lines.push(line(`Nivel: ${levelLabel[input.routine.level] || input.routine.level}`, { size: 10 }));
  lines.push(line(`Duracion: ${input.routine.durationWeeks} semanas | ${input.routine.daysPerWeek} dias por semana | Sesion: ${input.routine.sessionTimeMinutes || '-'} min`, { size: 10 }));
  lines.push(line(`Inicio: ${formatDate(input.startDate)} | Fin: ${formatDate(input.endDate)}`, { size: 10 }));

  for (const [dayIndex, day] of parseDays(input.routine.days).entries()) {
    lines.push(line(`${day.dayName} - ${day.focus}`, { size: 13, bold: true, color: primary, gapBefore: 16 }));
    if (!day.exercises.length) {
      lines.push(line('Sin ejercicios registrados.', { size: 10, color: muted }));
      continue;
    }

    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      const base = `${exerciseIndex + 1}. ${exercise.name} | Series: ${exercise.sets} | Reps: ${exercise.reps} | Descanso: ${exercise.rest}`;
      for (const [lineIndex, wrapped] of wrapText(base, 86).entries()) {
        lines.push(line(wrapped, { size: 9.5, bold: lineIndex === 0 }));
      }
      if (exercise.notes) {
        for (const wrapped of wrapText(`Notas: ${exercise.notes}`, 88)) lines.push(line(wrapped, { size: 9, color: muted }));
      }
    }
  }

  if (input.routine.notes || input.clientNotes) {
    lines.push(line('Notas del entrenador', { size: 13, bold: true, color: primary, gapBefore: 16 }));
    for (const wrapped of wrapText(`${input.routine.notes || ''}${input.clientNotes ? ` Notas para el cliente: ${input.clientNotes}` : ''}`, 86)) {
      lines.push(line(wrapped, { size: 9.5, color: muted }));
    }
  }

  lines.push(line('Este plan debe ajustarse si hay dolor, lesion o indicacion medica.', { size: 8.5, color: muted, gapBefore: 16 }));
  return lines;
}

function colorCommand(color?: [number, number, number]) {
  const [r, g, b] = color || [15, 23, 42];
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`;
}

function paginate(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  for (const item of lines) {
    const size = item.size || 10;
    const needed = (item.gapBefore || 0) + Math.max(LINE_HEIGHT, size + 5);
    if (y - needed < MARGIN + 24) {
      pages.push([]);
      y = PAGE_HEIGHT - MARGIN;
    }
    pages[pages.length - 1].push(item);
    y -= needed;
  }

  return pages;
}

function buildPageContent(lines: PdfLine[], pageNumber: number, pageCount: number, gymName: string) {
  const commands: string[] = [];
  commands.push('q 0.839 0.000 0.000 rg 0 822 595 20 re f Q');
  commands.push('q 0.961 0.965 0.973 rg 0 0 595 34 re f Q');

  let y = PAGE_HEIGHT - MARGIN;
  for (const item of lines) {
    y -= item.gapBefore || 0;
    const size = item.size || 10;
    const font = item.bold ? 'F2' : 'F1';
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(colorCommand(item.color));
    commands.push(`${MARGIN} ${y.toFixed(2)} Td`);
    commands.push(`(${escapePdfText(item.text)}) Tj`);
    commands.push('ET');
    y -= Math.max(LINE_HEIGHT, size + 5);
  }

  commands.push('BT /F1 8 Tf 0.392 0.455 0.545 rg 48 20 Td');
  commands.push(`(${escapePdfText(`${gymName} - Pagina ${pageNumber} de ${pageCount}`)}) Tj ET`);
  return commands.join('\n');
}

function createPdfBuffer(lines: PdfLine[], gymName: string) {
  const pages = paginate(lines);
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds: number[] = [];

  pages.forEach((pageLines, index) => {
    const content = buildPageContent(pageLines, index + 1, pages.length, gymName);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export async function generateWorkoutAssignmentPdf(assignmentId: string) {
  const assignment = await prisma.workoutAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      routine: true,
      client: { select: { nombre: true, apellidos: true } },
      trainer: { select: { email: true } },
    },
  });

  if (!assignment) throw new Error('No se encontro la asignacion de rutina para generar el PDF');

  const gymConfig = await prisma.gymConfig.findFirst();
  const gymName = gymConfig?.name || 'MEXA GYM';
  const lines = buildLines({
    gymName,
    gymPhone: gymConfig?.phone,
    gymEmail: gymConfig?.email,
    clientName: `${assignment.client.nombre} ${assignment.client.apellidos}`,
    trainerName: assignment.trainer?.email || 'Entrenador asignado',
    routine: assignment.routine,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    clientNotes: assignment.clientNotes,
  });

  const buffer = createPdfBuffer(lines, gymName);
  const directory = path.join(os.tmpdir(), 'mexa-gym-routines');
  await fs.mkdir(directory, { recursive: true });
  const fileName = `rutina_${safeFile(assignment.routine.name)}_${safeFile(assignment.client.nombre)}_${Date.now()}.pdf`;
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, buffer);
  return { filePath, fileName };
}

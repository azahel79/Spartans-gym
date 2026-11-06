import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import defaultLogo from '../assets/logo-2.png';
import type { AppearanceConfig } from '../config/appearance';
import type { GymConfig } from '../store/config.store';
import type { WorkoutAssignment, WorkoutRoutine } from '../types';

type PdfInput = {
  routine: WorkoutRoutine;
  assignment?: WorkoutAssignment;
  gymConfig: GymConfig;
  appearance: AppearanceConfig;
};

const levelLabel = (level: string) =>
  ({ PRINCIPIANTE: 'Principiante', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado' }[level] ?? level);

const safeFile = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const formatDate = (value?: string | null) => {
  if (!value) return 'No definida';
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: '2-digit' });
};

const hexToRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

const loadImageAsDataUrl = async (src?: string) => {
  const imageSrc = src || defaultLogo;
  try {
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    if (imageSrc !== defaultLogo) return loadImageAsDataUrl(defaultLogo);
    return null;
  }
};

function addFooter(doc: jsPDF, gymName: string, primary: [number, number, number]) {
  const pageCount = doc.getNumberOfPages();
  for (let index = 1; index <= pageCount; index += 1) {
    doc.setPage(index);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 282, 196, 282);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Este plan debe ajustarse si hay dolor, lesion o indicacion medica.', 14, 288);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(`${gymName || 'MEXA GYM'} - Pagina ${index} de ${pageCount}`, 196, 288, { align: 'right' });
  }
}

export async function printWorkoutPdf({ routine, assignment, gymConfig, appearance }: PdfInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primary = hexToRgb(appearance.primaryColor || '#d60000', [214, 0, 0]);
  const secondary = hexToRgb(appearance.secondaryColor || '#172554', [23, 37, 84]);
  const accent = hexToRgb(appearance.accentColor || '#38bdf8', [56, 189, 248]);
  const logo = await loadImageAsDataUrl(gymConfig.logo);
  const gymName = gymConfig.name || 'MEXA GYM';
  const clientName = assignment ? `${assignment.client.nombre} ${assignment.client.apellidos}` : 'Plantilla sin cliente asignado';
  const trainerEmail = assignment?.trainer?.email || routine.trainer?.email || 'Entrenador asignado';

  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFillColor(...accent);
  doc.rect(148, 0, 62, 8, 'F');

  if (logo) {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 16, 25, 25, 4, 4, 'S');
    doc.addImage(logo, 'PNG', 17, 19, 19, 19, undefined, 'FAST');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...secondary);
  doc.text(gymName.toUpperCase(), 44, 23);
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  doc.text('PLAN DE ENTRENAMIENTO PERSONALIZADO', 44, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${formatDate(new Date().toISOString())}`, 196, 19, { align: 'right' });
  if (gymConfig.phone) doc.text(gymConfig.phone, 196, 24, { align: 'right' });
  if (gymConfig.email) doc.text(gymConfig.email, 196, 29, { align: 'right' });

  doc.setFillColor(...secondary);
  doc.roundedRect(14, 49, 182, 34, 6, 6, 'F');
  doc.setFillColor(...primary);
  doc.roundedRect(14, 49, 5, 34, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text(routine.name || 'Rutina sin nombre', 24, 62, { maxWidth: 150 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(routine.objective || 'Objetivo no definido', 24, 71, { maxWidth: 158 });

  const infoRows = [
    ['Cliente', clientName, 'Entrenador', trainerEmail],
    ['Nivel', levelLabel(routine.level), 'Duración', `${routine.durationWeeks} semanas`],
    ['Días por semana', String(routine.daysPerWeek), 'Sesión', `${routine.sessionTimeMinutes || '-'} min`],
    ['Inicio', formatDate(assignment?.startDate), 'Fin', formatDate(assignment?.endDate)],
  ];

  autoTable(doc, {
    startY: 91,
    body: infoRows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: primary, cellWidth: 28 },
      1: { cellWidth: 62 },
      2: { fontStyle: 'bold', textColor: primary, cellWidth: 32 },
      3: { cellWidth: 60 },
    },
    margin: { left: 14, right: 14 },
  });

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120) + 8;

  routine.days.forEach((day, dayIndex) => {
    if (y > 238) {
      doc.addPage();
      y = 18;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 13, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.text(`DIA ${dayIndex + 1}`, 18, y + 5);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(`${day.dayName} - ${day.focus}`, 18, y + 10);
    y += 17;

    autoTable(doc, {
      startY: y,
      head: [['Ejercicio', 'Series', 'Reps', 'Descanso', 'Notas']],
      body: day.exercises.map((exercise) => [
        exercise.name,
        exercise.sets,
        exercise.reps,
        exercise.rest,
        exercise.notes || '-',
      ]),
      theme: 'grid',
      margin: { left: 14, right: 14 },
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 54 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 28 },
        4: { cellWidth: 54 },
      },
      didDrawPage: () => {
        doc.setFillColor(...primary);
        doc.rect(0, 0, 210, 5, 'F');
      },
    });

    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 9;
  });

  if (routine.notes || assignment?.clientNotes) {
    if (y > 238) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(253, 186, 116);
    doc.roundedRect(14, y, 182, 28, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(124, 45, 18);
    doc.text('Notas del entrenador', 19, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${routine.notes || ''}${assignment?.clientNotes ? `\n\nNotas para el cliente: ${assignment.clientNotes}` : ''}`, 19, y + 14, { maxWidth: 170 });
  }

  addFooter(doc, gymName, primary);

  const fileName = `rutina_${safeFile(routine.name || 'plantilla')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

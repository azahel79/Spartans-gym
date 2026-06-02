// helpers/dateHelpers.ts
export const calculateExpiryDate = (startDate: Date, planMonths: number): Date => {
  const expiry = new Date(startDate);
  expiry.setMonth(expiry.getMonth() + planMonths);
  return expiry;
};

export const getDaysLeft = (expiryDateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City',
  });
};


/**
 * Obtener fecha actual en formato YYYY-MM-DD (zona local)
 * Ejemplo: '2025-01-15'
 */
export const getTodayLocal = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convertir fecha ISO a string local YYYY-MM-DD
 * Ejemplo: '2025-01-15T03:00:00.000Z' → '2025-01-15'
 */
export const toLocalDateString = (isoDate: string | null | undefined): string | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verificar si una fecha ISO es el día de hoy (en zona local)
 */
export const isToday = (date: Date | string | null | undefined): boolean => {
  if (!date) return false;
  const today = new Date();
  const compareDate = new Date(date);
  
  return compareDate.getDate() === today.getDate() &&
         compareDate.getMonth() === today.getMonth() &&
         compareDate.getFullYear() === today.getFullYear();
};


/**
 * Formatear fecha ISO a formato legible (ej: "15 de enero de 2025")
 */
export const formatISODate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '-- --- ----';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '-- --- ----';
  
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
};

/**
 * Formatear fecha ISO para input date (YYYY-MM-DD)
 */
export const formatDateForInput = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};


export const getRelativeDate = (attendanceDate: string | null | undefined): string => {
  if (!attendanceDate) return 'Fecha desconocida';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const date = new Date(attendanceDate);
  date.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays === 2) return 'Anteayer';
  
  // Para fechas más antiguas, mostrar la fecha formateada
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
};

/**
 * Verificar si una fecha es hoy
 */
export const isTodayHistory = (isoDate: string | null | undefined): boolean => {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  return today.getTime() === date.getTime();
};

/**
 * Verificar si una fecha es ayer
 */
export const isYesterday = (isoDate: string | null | undefined): boolean => {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.getTime() === date.getTime();
};


// ✅ Verificar si el cliente ya asistió HOY
export const hasAttendedToday = (client: any): boolean => {
  if (!client?.attendanceDate) return false;
  return isToday(client.attendanceDate);
};

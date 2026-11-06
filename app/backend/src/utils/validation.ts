export class ValidationError extends Error {
  statusCode: number;
  details?: Record<string, string>;

  constructor(message: string, details?: Record<string, string>, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[0-9+\-()\s]{7,20}$/;

export function cleanString(value: unknown, field: string, options?: { min?: number; max?: number; required?: true }): string;
export function cleanString(value: unknown, field: string, options: { min?: number; max?: number; required: false }): string | undefined;
export function cleanString(value: unknown, field: string, options: { min?: number; max?: number; required?: boolean } = {}) {
  const { min = 1, max = 191, required = true } = options;
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return undefined;
    throw new ValidationError(`${field} es requerido`);
  }
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (required && cleaned.length < min) throw new ValidationError(`${field} debe tener al menos ${min} caracteres`);
  if (!required && cleaned.length === 0) return '';
  if (cleaned.length > max) throw new ValidationError(`${field} no puede exceder ${max} caracteres`);
  return cleaned;
}

export function parsePositiveNumber(value: unknown, field: string, options: { allowZero?: boolean; max?: number } = {}) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || (options.allowZero ? number < 0 : number <= 0)) {
    throw new ValidationError(`${field} debe ser un número ${options.allowZero ? 'mayor o igual a cero' : 'mayor a cero'}`);
  }
  if (options.max !== undefined && number > options.max) throw new ValidationError(`${field} no puede ser mayor a ${options.max}`);
  return number;
}

export function parseInteger(value: unknown, field: string, options: { min?: number; max?: number } = {}) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number)) throw new ValidationError(`${field} debe ser un número entero`);
  if (options.min !== undefined && number < options.min) throw new ValidationError(`${field} debe ser mayor o igual a ${options.min}`);
  if (options.max !== undefined && number > options.max) throw new ValidationError(`${field} no puede ser mayor a ${options.max}`);
  return number;
}

export function parseId(value: unknown, field = 'ID') {
  return parseInteger(value, field, { min: 1 });
}

export function parseEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} inválido. Valores permitidos: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function parseEmail(value: unknown, field = 'Email') {
  const email = cleanString(value, field, { min: 5, max: 254 }).toLowerCase();
  if (!EMAIL_REGEX.test(email)) throw new ValidationError(`${field} no tiene un formato válido`);
  return email;
}

export function parsePhone(value: unknown, field = 'Teléfono') {
  const phone = cleanString(value, field, { min: 7, max: 20 });
  if (!PHONE_REGEX.test(phone)) throw new ValidationError(`${field} no tiene un formato válido`);
  return phone;
}

export function validatePassword(value: unknown, field = 'Contraseña') {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) {
    throw new ValidationError(`${field} debe tener entre 10 y 128 caracteres`);
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw new ValidationError(`${field} debe incluir mayúscula, minúscula y número`);
  }
  return value;
}

export function optionalUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return null;
  const url = cleanString(value, field, { max: 2048 });
  try {
    const parsed = new URL(url as string);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new ValidationError(`${field} debe ser una URL HTTP válida`);
  }
}

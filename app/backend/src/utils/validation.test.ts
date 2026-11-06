import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanString,
  optionalUrl,
  parseEmail,
  parseEnum,
  parseInteger,
  parsePhone,
  parsePositiveNumber,
  validatePassword,
} from './validation';
import { normalizeWhatsAppPhone } from '../services/whatsapp.service';

test('normaliza cadenas y correos', () => {
  assert.equal(cleanString('  Juan   Pérez  ', 'Nombre'), 'Juan Pérez');
  assert.equal(parseEmail(' ADMIN@Example.COM '), 'admin@example.com');
});

test('valida teléfonos y contraseñas', () => {
  assert.equal(parsePhone('+52 55 1234 5678'), '+52 55 1234 5678');
  assert.equal(validatePassword('Password123'), 'Password123');
  assert.throws(() => validatePassword('corta'));
  assert.throws(() => parsePhone('abc'));
});

test('rechaza números inválidos', () => {
  assert.equal(parsePositiveNumber('12.50', 'Precio'), 12.5);
  assert.equal(parseInteger('4', 'Stock', { min: 0 }), 4);
  assert.throws(() => parsePositiveNumber(0, 'Precio'));
  assert.throws(() => parseInteger(-1, 'Stock', { min: 0 }));
});

test('valida enums y URLs', () => {
  assert.equal(parseEnum('admin', 'Rol', ['admin', 'recepcionista'] as const), 'admin');
  assert.equal(optionalUrl('https://example.com/logo.png', 'Logo'), 'https://example.com/logo.png');
  assert.throws(() => parseEnum('root', 'Rol', ['admin'] as const));
  assert.throws(() => optionalUrl('javascript:alert(1)', 'Logo'));
});

test('normaliza teléfonos mexicanos para WhatsApp', () => {
  assert.equal(normalizeWhatsAppPhone('55 1234 5678'), '525512345678');
  assert.equal(normalizeWhatsAppPhone('+52 55 1234 5678'), '525512345678');
  assert.equal(normalizeWhatsAppPhone('+52 1 55 1234 5678'), '525512345678');
  assert.equal(normalizeWhatsAppPhone('123'), null);
});

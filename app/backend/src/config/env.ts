import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const getRequiredEnv = (key: string, fallback = '') => {
  const value = process.env[key] || fallback;

  if (isProduction && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const getRequiredSecret = (key: string, fallback = '') => {
  const value = getRequiredEnv(key, fallback);

  if (isProduction && value.length < 32) {
    throw new Error(`${key} must be at least 32 characters in production`);
  }

  return value;
};

const normalizeOrigin = (url: string) => url.trim().replace(/\/+$/, '');
const normalizeValue = (value: string) => value.trim();

const parseUrlList = (value: string) =>
  value
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

const parseIntegerList = (value: string) =>
  [...new Set(value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0 && item <= 60))]
    .sort((a, b) => b - a);

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: isProduction,
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),
  JWT_SECRET: getRequiredSecret('JWT_SECRET', 'default_secret_change_me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: normalizeOrigin(process.env.FRONTEND_URL || 'http://localhost:5173'),
  ALLOWED_ORIGINS: parseUrlList(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: normalizeValue(process.env.CLOUDINARY_CLOUD_NAME || ''),
  CLOUDINARY_API_KEY: normalizeValue(process.env.CLOUDINARY_API_KEY || ''),
  CLOUDINARY_API_SECRET: normalizeValue(process.env.CLOUDINARY_API_SECRET || ''),
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  WHATSAPP_PROVIDER: normalizeValue(process.env.WHATSAPP_PROVIDER || 'webjs'),
  WHATSAPP_WEBJS_CLIENT_ID: normalizeValue(process.env.WHATSAPP_WEBJS_CLIENT_ID || 'mexa-gym-demo'),
  WHATSAPP_WEBJS_BROWSER_PATH: normalizeValue(process.env.WHATSAPP_WEBJS_BROWSER_PATH || ''),
  WHATSAPP_WEBJS_HEADLESS: process.env.WHATSAPP_WEBJS_HEADLESS !== 'false',
  WHATSAPP_ACCESS_TOKEN: normalizeValue(process.env.WHATSAPP_ACCESS_TOKEN || ''),
  WHATSAPP_PHONE_NUMBER_ID: normalizeValue(process.env.WHATSAPP_PHONE_NUMBER_ID || ''),
  WHATSAPP_GRAPH_VERSION: normalizeValue(process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'),
  WHATSAPP_LANGUAGE_CODE: normalizeValue(process.env.WHATSAPP_LANGUAGE_CODE || 'es_MX'),
  WHATSAPP_DEFAULT_COUNTRY_CODE: normalizeValue(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '52'),
  WHATSAPP_REMINDER_DAYS: parseIntegerList(process.env.WHATSAPP_REMINDER_DAYS || '5,3'),
  WHATSAPP_TEMPLATE_WELCOME: normalizeValue(process.env.WHATSAPP_TEMPLATE_WELCOME || 'gym_welcome'),
  WHATSAPP_TEMPLATE_EXPIRY_REMINDER: normalizeValue(process.env.WHATSAPP_TEMPLATE_EXPIRY_REMINDER || 'gym_expiry_reminder'),
  WHATSAPP_TEMPLATE_EXPIRED: normalizeValue(process.env.WHATSAPP_TEMPLATE_EXPIRED || 'gym_expired'),
  WHATSAPP_TEMPLATE_RENEWAL: normalizeValue(process.env.WHATSAPP_TEMPLATE_RENEWAL || 'gym_renewal'),
};



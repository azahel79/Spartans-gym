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

const parseUrlList = (value: string) =>
  value
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: isProduction,
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),
  JWT_SECRET: getRequiredSecret('JWT_SECRET', 'default_secret_change_me'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: normalizeOrigin(process.env.FRONTEND_URL || 'http://localhost:5173'),
  ALLOWED_ORIGINS: parseUrlList(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};

import { env } from '../config/env';

export const logger = {
  info: (...args: unknown[]) => {
    if (!env.IS_PRODUCTION) console.log(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

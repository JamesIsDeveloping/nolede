import dotenv from 'dotenv';
import { resolve } from 'path';

// __dirname = server/src/config — go up three levels to repo root
dotenv.config({ path: resolve(__dirname, '../../../.env') });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const env = {
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  PORT: parseInt(process.env.PORT ?? '3050', 10),
  // Semicolon-separated cron expressions. Defaults approximate 6am/12pm/3:30pm NZT (UTC+12).
  CRON_SCHEDULE: process.env.CRON_SCHEDULE ?? '0 18 * * *;0 0 * * *;30 3 * * *',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};

import { z } from 'zod';

const backendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  SUPABASE_URL: z.string().url().describe('Supabase project URL'),
  SUPABASE_ANON_KEY: z.string().describe('Supabase anonymous key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().describe('Supabase service role key'),
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
  JWT_SECRET: z.string().min(32).describe('JWT signing secret (min 32 chars)'),
  JWT_EXPIRY: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

const frontendEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
  VITE_APP_NAME: z.string().default('Payanam'),
  VITE_ENV: z.enum(['development', 'production']).default('development'),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;
export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

export function validateBackendEnv(env: Record<string, unknown>): BackendEnv {
  return backendEnvSchema.parse(env);
}

export function validateFrontendEnv(env: Record<string, unknown>): FrontendEnv {
  return frontendEnvSchema.parse(env);
}

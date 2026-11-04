import { createClient, SupabaseClient } from '@supabase/supabase-js';
import env from './environment';

let supabaseServiceClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

export function initializeDatabase(): void {
  const isPlaceholderKey =
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY.includes('REPLACE_WITH') ||
    env.SUPABASE_SERVICE_ROLE_KEY === 'your-service-role-key';

  const effectiveKey = isPlaceholderKey ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY;

  if (isPlaceholderKey) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY is using a placeholder. Falling back to SUPABASE_ANON_KEY. ' +
      'Please update SUPABASE_SERVICE_ROLE_KEY in .env.local for full backend permissions.'
    );
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(env.SUPABASE_URL, effectiveKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  if (!supabaseAnonClient) {
    supabaseAnonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
}

export function getDatabase(): SupabaseClient {
  if (!supabaseServiceClient) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return supabaseServiceClient;
}

export function getAnonDatabase(): SupabaseClient {
  if (!supabaseAnonClient) {
    throw new Error('Anon database not initialized. Call initializeDatabase() first.');
  }
  return supabaseAnonClient;
}

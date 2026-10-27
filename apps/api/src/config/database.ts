import { createClient, SupabaseClient } from '@supabase/supabase-js';
import env from './environment';

let supabaseServiceClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

export function initializeDatabase(): void {
  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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

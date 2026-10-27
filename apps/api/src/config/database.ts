import { createClient, SupabaseClient } from '@supabase/supabase-js';
import env from './environment';

let supabaseClient: SupabaseClient | null = null;

export function initializeDatabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

export function getDatabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return supabaseClient;
}

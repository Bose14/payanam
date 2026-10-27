import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL not found in .env.local');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    console.log('   Please add it to apps/api/.env.local');
    process.exit(1);
  }

  try {
    console.log(`📍 Connecting to: ${SUPABASE_URL}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Test 1: Check if we can query the users table
    console.log('\n✓ Client created successfully');

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Error querying users table:', error.message);
      process.exit(1);
    }

    console.log('✓ Successfully connected to Supabase!');
    console.log(`✓ Found ${data?.length || 0} users in database`);

    // Test 2: Check if tables exist
    const tables = ['users', 'sessions', 'audit_logs'];
    console.log('\n🗄️  Checking database schema...');

    for (const table of tables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (tableError && tableError.code === 'PGRST116') {
        console.log(`❌ Table '${table}' not found`);
        console.log('   Run: pnpm sql < docs/DATABASE_SETUP.sql');
        process.exit(1);
      }

      if (!tableError || tableError.code === '204') {
        console.log(`✓ Table '${table}' exists`);
      }
    }

    console.log('\n✅ All checks passed!');
    console.log('✅ Supabase is properly configured');
    console.log('\nYou can now run: pnpm dev\n');
  } catch (error) {
    console.error('❌ Connection failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testSupabaseConnection();

# Supabase Setup Guide

This guide walks you through configuring Supabase for the Payanam application.

## Step 1: Get Your Supabase Service Role Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `kusebqvhwpcblfusazus`
3. Go to **Settings** → **API**
4. Copy the **Service Role** key (labeled `service_role` or `service_role_key`)
   - ⚠️ Keep this secret! It has full database access.
5. Paste it in `apps/api/.env.local` as:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Step 2: Create Database Tables

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **+ New Query**
3. Copy the entire contents of `docs/DATABASE_SETUP.sql`
4. Paste it into the SQL Editor
5. Click **▶ Run** to execute the schema
6. You should see messages: "CREATE TABLE" and "CREATE INDEX" for each table

**Expected tables after running:**
- `users` - Stores user accounts
- `sessions` - Stores refresh tokens
- `audit_logs` - Stores action history

## Step 3: Generate JWT Secret

Replace the placeholder in `apps/api/.env.local`:

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long-replace-this
```

Generate a strong secret (minimum 32 characters):

**Option A: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: Online tool**
Visit [randomkeygen.com](https://randomkeygen.com) and copy a 256-bit key

**Option C: Manual**
```
jwt_secret_min_32_chars_payanam_2024_prod_key_v1
```

## Step 4: Verify Environment Variables

Check your `apps/api/.env.local` has:
```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://kusebqvhwpcblfusazus.supabase.co
SUPABASE_ANON_KEY=sb_publishable_267vrgTVwZCFHm44i5GM-A_SFFFr6Cc
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key
JWT_SECRET=your-actual-jwt-secret
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

And `apps/web/.env.local` has:
```env
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Payanam
VITE_ENV=development
VITE_SUPABASE_URL=https://kusebqvhwpcblfusazus.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_267vrgTVwZCFHm44i5GM-A_SFFFr6Cc
```

## Step 5: Test the Connection

Run the connection test:

```bash
pnpm tsx apps/api/scripts/test-supabase.ts
```

Expected output:
```
✅ Successfully connected to Supabase!
✅ Database schema verified
✅ Ready to go!
```

If you get an error, check:
- ✓ Service Role Key is correct
- ✓ Database tables exist (check Supabase dashboard)
- ✓ Network connection to supabase.co

## Step 6: Install Dependencies & Start

```bash
# Install all dependencies
pnpm install

# Start development servers
pnpm dev
```

Frontend will be at: **http://localhost:5173**
Backend will be at: **http://localhost:3001**

## Step 7: Test the Full Flow

1. Open http://localhost:5173 in your browser
2. Click **Register**
3. Enter:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Full Name: `Test User`
4. Click **Sign up**
5. You should be logged in and see the Dashboard
6. Click **Logout**
7. Click **Login** with the same credentials
8. You should see the Dashboard again

## Troubleshooting

### "Invalid API Key" error
- Check SUPABASE_SERVICE_ROLE_KEY is correct
- Verify it's copied completely (no extra spaces)

### "Connection refused" error
- Is the backend running? Check: `pnpm dev` output
- Is port 3001 available? Try: `lsof -i :3001`

### Tables don't exist
- Run the SQL schema again from Supabase SQL Editor
- Check that the SQL executed without errors

### Password hashing fails
- Ensure `bcrypt` is installed: `pnpm install`
- Check Node.js version: `node --version` (should be 18+)

### JWT token issues
- JWT_SECRET must be at least 32 characters
- JWT_SECRET must be the same on backend and frontend
- Check expiry times: JWT_EXPIRY=24h, REFRESH_TOKEN_EXPIRY=7d

## Next Steps

- [ ] Get Service Role Key from Supabase
- [ ] Run DATABASE_SETUP.sql in Supabase SQL Editor
- [ ] Update `.env.local` files
- [ ] Run `pnpm install`
- [ ] Run `pnpm tsx apps/api/scripts/test-supabase.ts` to test
- [ ] Start dev server: `pnpm dev`
- [ ] Test registration and login flow

## Production Deployment

For production, update:
- Supabase project URL to production instance
- JWT_SECRET to a cryptographically secure value
- CORS_ORIGIN to your production frontend URL
- Enable Row Level Security (RLS) policies in Supabase
- Set up backup and monitoring in Supabase Dashboard

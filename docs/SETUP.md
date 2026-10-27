# Local Development Setup Guide

## Prerequisites

- Node.js 18+ (recommend 20 LTS)
- pnpm 8+ (`npm install -g pnpm`)
- Git
- A Supabase account

## Step 1: Clone and Install

```bash
git clone https://github.com/yourusername/payanam.git
cd payanam
pnpm install
```

## Step 2: Create Environment Files

Copy the example environment files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local
```

## Step 3: Configure Supabase

1. Create a new Supabase project at https://supabase.com
2. In your project settings, copy:
   - Project URL → `SUPABASE_URL`
   - Anon Key → `SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`

3. In SQL Editor, run the migration:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
```

4. Configure DATABASE_URL in `apps/api/.env.local` with your PostgreSQL connection string

## Step 4: Generate JWT Secret

```bash
openssl rand -base64 32
```

Copy the output to `JWT_SECRET` in `apps/api/.env.local`

## Step 5: Update Environment Files

### apps/web/.env.local

```
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Payanam
VITE_ENV=development
```

### apps/api/.env.local

```
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
JWT_SECRET=your-generated-secret
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

## Step 6: Start Development Servers

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health

## Step 7: Test the Application

1. Open http://localhost:5173 in your browser
2. Click "Register here" and create an account
3. Fill in the form and submit
4. You should be redirected to the dashboard
5. Click "Logout" to test the logout flow

## Useful Commands

```bash
# Run only frontend
pnpm dev --filter=web

# Run only backend
pnpm dev --filter=api

# Build all packages
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm type-check

# Format code
pnpm format

# Run tests
pnpm test
```

## Troubleshooting

### Port already in use
- Frontend: Change port in `apps/web/vite.config.ts`
- Backend: Change PORT in `apps/api/.env.local`

### Database connection error
- Verify DATABASE_URL format
- Ensure your IP is allowed in Supabase firewall
- Check PostgreSQL credentials

### JWT Secret too short
- Generate a new secret: `openssl rand -base64 32`
- Must be at least 32 characters

## Next Steps

See [API.md](./API.md) for API endpoint documentation.

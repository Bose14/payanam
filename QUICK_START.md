# Quick Start Guide

Get Payanam running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Supabase project created (you have the URL and publishable key)

## Step 1: Get Service Role Key (5 min)

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select project: `kusebqvhwpcblfusazus`
3. Go to: **Settings** → **API**
4. Copy the **Service Role** key
5. Paste it in `apps/api/.env.local` replacing `REPLACE_WITH_YOUR_SERVICE_ROLE_KEY`

## Step 2: Create Database Tables (2 min)

1. In Supabase, go to **SQL Editor**
2. Click **+ New Query**
3. Copy all content from: `docs/DATABASE_SETUP.sql`
4. Paste and click **Run**

## Step 3: Generate JWT Secret (1 min)

Run this in PowerShell:
```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
```

Copy the output and update `JWT_SECRET` in `apps/api/.env.local`

## Step 4: Install & Test (2 min)

```powershell
# Install dependencies
pnpm install

# Test Supabase connection
pnpm tsx apps/api/scripts/test-supabase.ts
```

Expected output:
```
✅ All checks passed!
✅ Supabase is properly configured
```

## Step 5: Run Application (1 min)

```powershell
pnpm dev
```

Open in browser:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Step 6: Test Registration Flow (2 min)

1. Go to http://localhost:5173
2. Click **Register**
3. Fill in:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Full Name: `Test User`
4. Click **Sign up**
5. You're logged in! 🎉

## Troubleshooting

### ❌ "Service Role Key error"
- Copy the entire key (should be long, 200+ characters)
- No spaces before/after
- Refresh the Supabase page and try again

### ❌ "Table does not exist"
- Run the SQL from `docs/DATABASE_SETUP.sql` again
- Check Supabase SQL Editor for errors

### ❌ "Connection refused"
- Make sure `pnpm dev` is running
- Check terminal for any errors

## Next Steps

- ✅ Read full setup guide: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- ✅ View API documentation: [API.md](./docs/API.md)
- ✅ Deploy to GitHub: See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) (coming soon)
- ✅ Learn architecture: See [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## File Locations

```
payanam/
├── apps/
│   ├── web/                # Frontend
│   │   └── .env.local      # ✅ Already configured
│   └── api/                # Backend
│       └── .env.local      # ⚠️ Update SERVICE_ROLE_KEY here
├── docs/
│   ├── DATABASE_SETUP.sql  # ✅ Run this in Supabase
│   └── API.md             # API endpoints reference
└── SUPABASE_SETUP.md      # Full setup guide
```

---

**Questions?** Check the troubleshooting section in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

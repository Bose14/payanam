# Database Schema

## Overview

Payanam uses PostgreSQL (via Supabase) for data persistence. This document describes the database schema and relationships.

## Tables

### Users Table

Stores user account information.

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
```

**Columns:**
- `id`: Unique user identifier (UUID)
- `email`: User email (unique, required)
- `password_hash`: Bcrypt hashed password
- `full_name`: User's full name
- `avatar_url`: URL to user's avatar image
- `status`: Account status (active/inactive/suspended)
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp
- `last_login_at`: Last login timestamp

**Indexes:**
- Primary key on `id`
- Unique index on `email`

---

### Sessions Table

Stores user session tokens (for future use).

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique session identifier
- `user_id`: Reference to user
- `token`: Session token
- `expires_at`: Token expiration timestamp
- `created_at`: Session creation timestamp

**Relationships:**
- `user_id` → `users.id` (CASCADE delete)

---

### Audit Logs Table (Future)

For tracking user actions and changes.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100),
  resource VARCHAR(100),
  resource_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Row Level Security (RLS)

RLS is enabled on sensitive tables to ensure users can only access their own data:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
```

Policies will be added as needed.

---

## Migrations

### Initial Schema (v1)

Run this migration when setting up the database:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
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

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

---

## Backup Strategy

1. **Automatic**: Supabase provides daily automated backups
2. **Manual**: Use Supabase dashboard to create backups before major changes
3. **Retention**: Backups retained for 30 days

---

## Performance Optimization

### Current Indexes

- Primary keys (automatic)
- Unique constraint on `users.email`
- Index on `users.created_at` for sorting

### Planned Indexes

As the application grows:
- `sessions.expires_at` for cleanup queries
- `audit_logs.user_id` for audit trails
- Composite indexes for common filtered queries

---

## Data Retention

- **Active users**: Kept indefinitely
- **Inactive users**: Can be archived after 2 years
- **Sessions**: Deleted after expiration
- **Audit logs**: Retained for 1 year for compliance

---

## Disaster Recovery

1. **RTO (Recovery Time Objective)**: < 1 hour
2. **RPO (Recovery Point Objective)**: < 1 day (depends on backup frequency)
3. **Backup location**: Supabase's secure storage (US region)
4. **Recovery procedure**: Contact Supabase support or restore from dashboard

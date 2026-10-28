-- Expense tracker tables — run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(50) DEFAULT 'other',
  paid_by UUID NOT NULL REFERENCES users(id),
  split_type VARCHAR(20) DEFAULT 'equal',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10,2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);

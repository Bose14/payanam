import { getDatabase } from '../config/database';
import { assertUserTripMembership } from './trip.service';

interface AddExpenseData {
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  split_type: 'equal' | 'custom';
  split_among?: string[];
  custom_splits?: Array<{ user_id: string; amount: number }>;
}

async function verifyMember(_db: ReturnType<typeof getDatabase>, tripId: string, userId: string) {
  const auth = await assertUserTripMembership(tripId, userId);
  if (auth.status !== 'approved') throw new Error('Not authorized');
}

export async function addExpense(tripId: string, userId: string, data: AddExpenseData) {
  const db = getDatabase();
  await verifyMember(db, tripId, userId);

  const { data: expense, error } = await db
    .from('trip_expenses')
    .insert({
      trip_id: tripId,
      added_by: userId,
      title: data.title,
      amount: data.amount,
      category: data.category,
      paid_by: data.paid_by,
      split_type: data.split_type,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  let splits: Array<{ expense_id: string; user_id: string; amount: number }> = [];

  if (data.split_type === 'equal' && data.split_among && data.split_among.length > 0) {
    const n = data.split_among.length;
    const base = Math.floor((data.amount / n) * 100) / 100;
    const remainder = Math.round((data.amount - base * n) * 100) / 100;
    splits = data.split_among.map((uid, i) => ({
      expense_id: expense.id,
      user_id: uid,
      amount: i === 0 ? Math.round((base + remainder) * 100) / 100 : base,
    }));
  } else if (data.split_type === 'custom' && data.custom_splits) {
    splits = data.custom_splits
      .filter(s => s.amount > 0)
      .map(s => ({ expense_id: expense.id, user_id: s.user_id, amount: s.amount }));
  }

  if (splits.length > 0) {
    const { error: splitError } = await db.from('expense_splits').insert(splits);
    if (splitError) throw new Error(splitError.message);
  }

  return expense;
}

export async function getExpenses(tripId: string, userId: string) {
  const db = getDatabase();
  await verifyMember(db, tripId, userId);

  const { data, error } = await db
    .from('trip_expenses')
    .select('*, expense_splits(*)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteExpense(expenseId: string, userId: string) {
  const db = getDatabase();

  const { data: expense } = await db
    .from('trip_expenses')
    .select('added_by')
    .eq('id', expenseId)
    .single();

  if (!expense) throw new Error('Expense not found');
  if (expense.added_by !== userId) throw new Error('Not authorized');

  const { error } = await db.from('trip_expenses').delete().eq('id', expenseId);
  if (error) throw new Error(error.message);
}

export async function toggleSplitSettled(splitId: string, userId: string) {
  const db = getDatabase();
  const { data: split, error: fetchErr } = await db
    .from('expense_splits')
    .select('id, user_id, is_settled, expense_id')
    .eq('id', splitId)
    .single();

  if (fetchErr || !split) throw new Error('Split not found');

  const { data: expense } = await db
    .from('trip_expenses')
    .select('paid_by')
    .eq('id', split.expense_id)
    .single();

  if (split.user_id !== userId && expense?.paid_by !== userId) {
    throw new Error('Not authorized to settle this split');
  }

  const { data: updated, error } = await db
    .from('expense_splits')
    .update({ is_settled: !split.is_settled })
    .eq('id', splitId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

export async function recordSettlement(
  tripId: string,
  userId: string,
  data: { fromUserId: string; toUserId: string; amount: number; notes?: string }
) {
  const db = getDatabase();
  await verifyMember(db, tripId, userId);

  if (!data.fromUserId || !data.toUserId || !data.amount || data.amount <= 0) {
    throw new Error('Invalid settlement data: fromUserId, toUserId, and amount > 0 required');
  }

  const { data: fromUser } = await db.from('users').select('full_name').eq('id', data.fromUserId).maybeSingle();
  const { data: toUser } = await db.from('users').select('full_name').eq('id', data.toUserId).maybeSingle();

  const title = `Settlement: ${fromUser?.full_name || 'Rider'} paid ${toUser?.full_name || 'Rider'}`;

  const { data: expense, error } = await db
    .from('trip_expenses')
    .insert({
      trip_id: tripId,
      added_by: userId,
      title,
      amount: data.amount,
      category: 'settlement',
      paid_by: data.fromUserId,
      split_type: 'custom',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: splitError } = await db.from('expense_splits').insert([
    {
      expense_id: expense.id,
      user_id: data.toUserId,
      amount: data.amount,
      is_settled: true,
    },
  ]);

  if (splitError) throw new Error(splitError.message);

  return expense;
}

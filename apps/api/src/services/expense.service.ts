import { getDatabase } from '../config/database';

interface AddExpenseData {
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  split_type: 'equal' | 'custom';
  split_among?: string[];
  custom_splits?: Array<{ user_id: string; amount: number }>;
}

async function verifyMember(db: ReturnType<typeof getDatabase>, tripId: string, userId: string) {
  const { data: trip } = await db.from('trips').select('id, user_id').eq('id', tripId).maybeSingle();
  if (!trip) throw new Error('Trip not found');
  if (trip.user_id === userId) return;

  const { data: room } = await db.from('rooms').select('id').eq('trip_id', tripId).maybeSingle();
  if (!room) throw new Error('Not authorized');

  const { data: member } = await db
    .from('room_members')
    .select('status')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member || member.status !== 'approved') throw new Error('Not authorized');
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

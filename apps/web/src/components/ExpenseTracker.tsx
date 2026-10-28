import { useState, useEffect, useCallback } from 'react';
import { tripService } from '../services/api';

interface Participant {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'member';
}

interface ExpenseSplit {
  id: string;
  user_id: string;
  amount: number;
  is_settled: boolean;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  split_type: 'equal' | 'custom';
  added_by: string;
  created_at: string;
  expense_splits: ExpenseSplit[];
}

interface Props {
  tripId: string;
  currentUserId: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  fuel: '⛽', food: '🍽️', stay: '🏨', toll: '🚧',
  parking: '🅿️', repairs: '🔧', other: '💸',
};

const CATEGORIES = [
  { value: 'fuel', label: '⛽ Fuel' },
  { value: 'food', label: '🍽️ Food' },
  { value: 'stay', label: '🏨 Stay' },
  { value: 'toll', label: '🚧 Toll' },
  { value: 'parking', label: '🅿️ Parking' },
  { value: 'repairs', label: '🔧 Repairs' },
  { value: 'other', label: '💸 Other' },
];

function fmt(n: number) { return `₹${n.toFixed(2)}`; }

function calculateBalances(expenses: Expense[], participants: Participant[]) {
  const balances: Record<string, number> = {};
  participants.forEach(p => { balances[p.id] = 0; });
  expenses.forEach(e => {
    if (balances[e.paid_by] !== undefined) balances[e.paid_by] += e.amount;
    e.expense_splits.forEach(s => {
      if (balances[s.user_id] !== undefined) balances[s.user_id] -= s.amount;
    });
  });
  return balances;
}

function simplifyDebts(balances: Record<string, number>, participants: Participant[]) {
  const creditors = participants.filter(p => balances[p.id] > 0.005).map(p => ({ ...p, bal: balances[p.id] }));
  const debtors = participants.filter(p => balances[p.id] < -0.005).map(p => ({ ...p, bal: -balances[p.id] }));
  const txns: Array<{ from: Participant; to: Participant; amount: number }> = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].bal, debtors[j].bal);
    if (amount > 0.005) txns.push({ from: debtors[j], to: creditors[i], amount: Math.round(amount * 100) / 100 });
    creditors[i].bal -= amount;
    debtors[j].bal -= amount;
    if (creditors[i].bal < 0.005) i++;
    if (debtors[j].bal < 0.005) j++;
  }
  return txns;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };

export default function ExpenseTracker({ tripId, currentUserId }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');

  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'other',
    paid_by: currentUserId,
    split_type: 'equal' as 'equal' | 'custom',
    split_among: [] as string[],
    custom_splits: {} as Record<string, string>,
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [parts, exps] = await Promise.all([
        tripService.getTripParticipants(tripId),
        tripService.getExpenses(tripId),
      ]);
      setParticipants(parts);
      setExpenses(exps);
    } catch {
      showToast('❌ Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openModal = () => {
    setForm({
      title: '',
      amount: '',
      category: 'other',
      paid_by: currentUserId,
      split_type: 'equal',
      split_among: participants.map(p => p.id),
      custom_splits: Object.fromEntries(participants.map(p => [p.id, ''])),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim()) { showToast('❌ Enter a title'); return; }
    if (!amount || amount <= 0) { showToast('❌ Enter a valid amount'); return; }
    if (form.split_type === 'equal' && form.split_among.length === 0) { showToast('❌ Select at least one person to split'); return; }
    if (form.split_type === 'custom') {
      const total = Object.values(form.custom_splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(total - amount) > 0.01) {
        showToast(`❌ Splits total ₹${total.toFixed(2)}, must equal ₹${amount.toFixed(2)}`);
        return;
      }
    }
    setSaving(true);
    try {
      await tripService.addExpense(tripId, {
        title: form.title.trim(),
        amount,
        category: form.category,
        paid_by: form.paid_by,
        split_type: form.split_type,
        split_among: form.split_type === 'equal' ? form.split_among : undefined,
        custom_splits: form.split_type === 'custom'
          ? Object.entries(form.custom_splits)
              .filter(([, v]) => parseFloat(v) > 0)
              .map(([user_id, v]) => ({ user_id, amount: parseFloat(v) }))
          : undefined,
      });
      setShowModal(false);
      showToast('✅ Expense added');
      await loadData();
    } catch {
      showToast('❌ Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    setDeletingId(expenseId);
    try {
      await tripService.deleteExpense(tripId, expenseId);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      showToast('✅ Expense deleted');
    } catch {
      showToast('❌ Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const getName = (id: string) => participants.find(p => p.id === id)?.full_name ?? 'Unknown';

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const balances = calculateBalances(expenses, participants);
  const settlements = simplifyDebts(balances, participants);

  const customTotal = Object.values(form.custom_splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const customRemaining = parseFloat(form.amount || '0') - customTotal;

  if (loading) return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 32, textAlign: 'center', color: '#6b7280' }}>
      Loading expenses...
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.startsWith('✅') ? '#166534' : '#991b1b', color: 'white', padding: '10px 24px', borderRadius: 8, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>💸 Trip Expenses</h3>
          {totalAmount > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
              Total: <strong style={{ color: '#111827' }}>{fmt(totalAmount)}</strong>
              {expenses.length > 0 && <span style={{ marginLeft: 8 }}>· {expenses.length} item{expenses.length !== 1 ? 's' : ''}</span>}
            </p>
          )}
        </div>
        <button onClick={openModal} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #0f3460, #533483)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          + Add Expense
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
        {(['expenses', 'balances'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: activeTab === tab ? '#eff6ff' : 'transparent', color: activeTab === tab ? '#1d4ed8' : '#6b7280', borderBottom: activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent' }}>
            {tab === 'expenses' ? `📋 Expenses (${expenses.length})` : '⚖️ Balances'}
          </button>
        ))}
      </div>

      {/* Expenses tab */}
      {activeTab === 'expenses' && (
        <div style={{ padding: '0 20px 20px' }}>
          {expenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💸</div>
              <p style={{ margin: 0 }}>No expenses yet — add the first one!</p>
            </div>
          ) : (
            expenses.map(expense => {
              const myShare = expense.expense_splits.find(s => s.user_id === currentUserId);
              return (
                <div key={expense.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '14px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
                      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{CATEGORY_ICONS[expense.category] ?? '💸'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{expense.title}</span>
                          <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                            {CATEGORIES.find(c => c.value === expense.category)?.label.split(' ').slice(1).join(' ') ?? expense.category}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 2px', fontSize: 13, color: '#6b7280' }}>
                          Paid by <strong style={{ color: '#1d4ed8' }}>{getName(expense.paid_by)}</strong>
                          {expense.split_type === 'equal'
                            ? ` · Equal (${expense.expense_splits.length} people)`
                            : ' · Custom split'}
                        </p>
                        {myShare && (
                          <p style={{ margin: 0, fontSize: 12, color: myShare.is_settled ? '#16a34a' : '#d97706' }}>
                            Your share: <strong>{fmt(myShare.amount)}</strong>
                            {myShare.is_settled ? ' ✅ Settled' : ' ⏳ Pending'}
                          </p>
                        )}
                        {!myShare && expense.paid_by === currentUserId && (
                          <p style={{ margin: 0, fontSize: 12, color: '#16a34a' }}>You paid this</p>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#111827' }}>{fmt(expense.amount)}</p>
                      {expense.added_by === currentUserId && (
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          style={{ marginTop: 4, padding: '2px 8px', background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 11, borderRadius: 4, fontWeight: 600, opacity: deletingId === expense.id ? 0.5 : 1 }}
                        >
                          {deletingId === expense.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Balances tab */}
      {activeTab === 'balances' && (
        <div style={{ padding: '16px 20px' }}>
          {participants.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', margin: 0 }}>No participants yet</p>
          ) : expenses.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', margin: 0 }}>Add expenses to see balances</p>
          ) : (
            <>
              {/* Per-person balance */}
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                Net Balance
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {participants.map(p => {
                  const bal = balances[p.id] ?? 0;
                  const isMe = p.id === currentUserId;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isMe ? '#eff6ff' : '#f9fafb', borderRadius: 8, border: `1px solid ${isMe ? '#bfdbfe' : '#e5e7eb'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: isMe ? '#1d4ed8' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {p.full_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                            {p.full_name}{isMe ? ' (you)' : ''}
                          </span>
                          {p.role === 'owner' && <span style={{ fontSize: 11, marginLeft: 5, color: '#1d4ed8' }}>👑</span>}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: bal > 0.005 ? '#16a34a' : bal < -0.005 ? '#dc2626' : '#6b7280' }}>
                        {bal > 0.005 ? `+${fmt(bal)}` : fmt(bal)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Who owes whom */}
              {settlements.length > 0 ? (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
                    💳 Settle Up
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {settlements.map((txn, i) => (
                      <div key={i} style={{ padding: '10px 14px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
                        <strong style={{ color: txn.from.id === currentUserId ? '#dc2626' : '#92400e' }}>
                          {txn.from.id === currentUserId ? 'You' : txn.from.full_name}
                        </strong>
                        {' '}→ pay{' '}
                        <strong>{txn.to.id === currentUserId ? 'you' : txn.to.full_name}</strong>
                        {' · '}
                        <strong style={{ color: '#b45309' }}>{fmt(txn.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#16a34a', fontWeight: 600, fontSize: 14 }}>
                  ✅ All settled up!
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Add Expense</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>What for?</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Petrol at HP Pump, Dinner at dhaba..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle}>Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#6b7280', pointerEvents: 'none' }}>₹</span>
                  <input
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    style={{ ...inputStyle, paddingLeft: 28 }}
                  />
                </div>
              </div>

              {/* Category + Paid by */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Paid by</label>
                  <select value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))} style={inputStyle}>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}{p.id === currentUserId ? ' (you)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split type toggle */}
              <div>
                <label style={labelStyle}>Split type</label>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  {(['equal', 'custom'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, split_type: t }))}
                      style={{ flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: form.split_type === t ? '#1d4ed8' : '#f9fafb', color: form.split_type === t ? '#fff' : '#374151' }}
                    >
                      {t === 'equal' ? '= Equal split' : '✏️ Custom split'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equal split — checkboxes */}
              {form.split_type === 'equal' && (
                <div>
                  <label style={labelStyle}>Split among</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {participants.map(p => {
                      const checked = form.split_among.includes(p.id);
                      const perPerson = form.amount && form.split_among.length > 0
                        ? parseFloat(form.amount) / form.split_among.length
                        : 0;
                      return (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: checked ? '#eff6ff' : '#f9fafb', borderRadius: 8, border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`, cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setForm(f => ({
                              ...f,
                              split_among: e.target.checked
                                ? [...f.split_among, p.id]
                                : f.split_among.filter(id => id !== p.id),
                            }))}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#111827' }}>
                            {p.full_name}{p.id === currentUserId ? ' (you)' : ''}
                          </span>
                          {checked && perPerson > 0 && (
                            <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>{fmt(perPerson)}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom split — amount inputs */}
              {form.split_type === 'custom' && (
                <div>
                  <label style={labelStyle}>Custom amounts</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {participants.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#111827' }}>
                          {p.full_name}{p.id === currentUserId ? ' (you)' : ''}
                        </span>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#6b7280', pointerEvents: 'none' }}>₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.custom_splits[p.id] ?? ''}
                            onChange={e => setForm(f => ({ ...f, custom_splits: { ...f.custom_splits, [p.id]: e.target.value } }))}
                            style={{ width: 90, padding: '7px 7px 7px 22px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: Math.abs(customRemaining) < 0.01 ? '#f0fdf4' : '#fef9c3',
                      border: `1px solid ${Math.abs(customRemaining) < 0.01 ? '#bbf7d0' : '#fde68a'}`,
                      color: Math.abs(customRemaining) < 0.01 ? '#16a34a' : '#b45309',
                    }}>
                      {Math.abs(customRemaining) < 0.01
                        ? '✅ Amounts match!'
                        : `${customRemaining > 0 ? `₹${customRemaining.toFixed(2)} left to assign` : `₹${Math.abs(customRemaining).toFixed(2)} over total`}`}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{ padding: '12px', background: 'linear-gradient(135deg, #0f3460, #533483)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 4 }}
              >
                {saving ? 'Saving...' : '+ Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  trip_id: string;
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
  tripTitle?: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  fuel: { label: 'Fuel', icon: '⛽', color: '#d97706', bg: '#fef3c7' },
  food: { label: 'Food & Chai', icon: '🍽️', color: '#059669', bg: '#d1fae5' },
  stay: { label: 'Stay', icon: '🏨', color: '#2563eb', bg: '#dbeafe' },
  toll: { label: 'Tolls', icon: '🚧', color: '#7c3aed', bg: '#ede9fe' },
  repairs: { label: 'Spares & Repair', icon: '🔧', color: '#dc2626', bg: '#fee2e2' },
  parking: { label: 'Parking', icon: '🅿️', color: '#0891b2', bg: '#cffafe' },
  settlement: { label: 'Debt Settlement', icon: '🤝', color: '#4f46e5', bg: '#e0e7ff' },
  other: { label: 'Other', icon: '💸', color: '#4b5563', bg: '#f3f4f6' },
};

const CATEGORIES = Object.entries(CATEGORY_MAP).map(([value, info]) => ({
  ...info,
  value,
  label: `${info.icon} ${info.label}`,
}));

const QUICK_PRESETS = [
  { label: '⛽ Full Tank', category: 'fuel', title: 'Petrol / Fuel Refill', amount: '1500' },
  { label: '🍽️ Dhaba / Meal', category: 'food', title: 'Highway Dhaba Lunch', amount: '500' },
  { label: '☕ Chai & Snacks', category: 'food', title: 'Chai & Snacks Break', amount: '150' },
  { label: '🚧 Highway Toll', category: 'toll', title: 'Fastag Toll Plaza', amount: '135' },
  { label: '🏨 Hotel / Stay', category: 'stay', title: 'Hotel / Homestay Room', amount: '2200' },
  { label: '🔧 Chain / Puncture', category: 'repairs', title: 'Puncture / Chain Lube', amount: '250' },
];

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtDec(n: number) {
  return `₹${(Math.round(n * 100) / 100).toFixed(2)}`;
}

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
  const creditors = participants
    .filter(p => balances[p.id] > 0.01)
    .map(p => ({ ...p, bal: balances[p.id] }));
  const debtors = participants
    .filter(p => balances[p.id] < -0.01)
    .map(p => ({ ...p, bal: -balances[p.id] }));

  const txns: Array<{ from: Participant; to: Participant; amount: number }> = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].bal, debtors[j].bal);
    if (amount > 0.01) {
      txns.push({
        from: debtors[j],
        to: creditors[i],
        amount: Math.round(amount * 100) / 100,
      });
    }
    creditors[i].bal -= amount;
    debtors[j].bal -= amount;
    if (creditors[i].bal < 0.01) i++;
    if (debtors[j].bal < 0.01) j++;
  }
  return txns;
}

export default function ExpenseTracker({ tripId, currentUserId, tripTitle = 'Road Trip' }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settlingSplitId, setSettlingSplitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'analytics' | 'balances'>('expenses');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Settle-Up Modal state
  const [settleModal, setSettleModal] = useState<{
    show: boolean;
    from: Participant | null;
    to: Participant | null;
    amount: number;
    upiId: string;
    isSettling: boolean;
  }>({
    show: false,
    from: null,
    to: null,
    amount: 0,
    upiId: '',
    isSettling: false,
  });

  // Add Expense Form State
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'fuel',
    paid_by: currentUserId,
    split_type: 'equal' as 'equal' | 'custom',
    split_among: [] as string[],
    custom_splits: {} as Record<string, string>,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

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
      showToast('❌ Failed to load trip expenses');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = () => {
    setForm({
      title: '',
      amount: '',
      category: 'fuel',
      paid_by: currentUserId,
      split_type: 'equal',
      split_among: participants.map(p => p.id),
      custom_splits: Object.fromEntries(participants.map(p => [p.id, ''])),
    });
    setShowModal(true);
  };

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      title: preset.title,
      category: preset.category,
      amount: preset.amount,
    }));
  };

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim()) {
      showToast('❌ Enter an expense description');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('❌ Enter a valid amount greater than 0');
      return;
    }
    if (form.split_type === 'equal' && form.split_among.length === 0) {
      showToast('❌ Select at least one person to split');
      return;
    }
    if (form.split_type === 'custom') {
      const total = Object.values(form.custom_splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(total - amount) > 0.05) {
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
      showToast('✅ Expense recorded');
      await loadData();
    } catch {
      showToast('❌ Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    setDeletingId(expenseId);
    try {
      await tripService.deleteExpense(tripId, expenseId);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      showToast('✅ Expense deleted');
    } catch {
      showToast('❌ Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleSplitSettled = async (splitId: string) => {
    setSettlingSplitId(splitId);
    try {
      await tripService.toggleSplitSettled(tripId, splitId);
      await loadData();
      showToast('✅ Split status updated');
    } catch {
      showToast('❌ Failed to update split status');
    } finally {
      setSettlingSplitId(null);
    }
  };

  // Open Settle-Up modal for a specific debt
  const openSettleModal = (from: Participant, to: Participant, amount: number) => {
    // Generate suggested UPI ID based on name or email
    const cleanName = to.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suggestedUpi = `${cleanName}@okaxis`;
    setSettleModal({
      show: true,
      from,
      to,
      amount,
      upiId: suggestedUpi,
      isSettling: false,
    });
  };

  const confirmSettlement = async () => {
    if (!settleModal.from || !settleModal.to) return;
    setSettleModal(prev => ({ ...prev, isSettling: true }));
    try {
      await tripService.recordSettlement(tripId, {
        fromUserId: settleModal.from.id,
        toUserId: settleModal.to.id,
        amount: settleModal.amount,
      });
      showToast(`✅ Recorded ₹${settleModal.amount} settlement!`);
      setSettleModal({ show: false, from: null, to: null, amount: 0, upiId: '', isSettling: false });
      await loadData();
    } catch {
      showToast('❌ Failed to record settlement');
      setSettleModal(prev => ({ ...prev, isSettling: false }));
    }
  };

  const getName = (id: string) => participants.find(p => p.id === id)?.full_name ?? 'Rider';

  // Calculations
  const nonSettlementExpenses = useMemo(() => expenses.filter(e => e.category !== 'settlement'), [expenses]);
  const totalAmount = useMemo(() => nonSettlementExpenses.reduce((s, e) => s + e.amount, 0), [nonSettlementExpenses]);
  const balances = useMemo(() => calculateBalances(expenses, participants), [expenses, participants]);
  const settlements = useMemo(() => simplifyDebts(balances, participants), [balances, participants]);

  // Category stats
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    nonSettlementExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percentage: totalAmount > 0 ? (amt / totalAmount) * 100 : 0,
        ...CATEGORY_MAP[cat] || CATEGORY_MAP.other,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [nonSettlementExpenses, totalAmount]);

  // Contributor stats
  const contributorStats = useMemo(() => {
    const map: Record<string, number> = {};
    participants.forEach(p => { map[p.id] = 0; });
    expenses.forEach(e => {
      if (map[e.paid_by] !== undefined) map[e.paid_by] += e.amount;
    });
    return Object.entries(map)
      .map(([userId, amt]) => ({
        userId,
        name: getName(userId),
        amount: amt,
        percentage: totalAmount > 0 ? (amt / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, participants, totalAmount]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const matchQuery = !searchQuery.trim() ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getName(e.paid_by).toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [expenses, selectedCategory, searchQuery, participants]);

  // WhatsApp summary generator
  const generateWhatsAppSummary = () => {
    let msg = `🏍️ *${tripTitle.toUpperCase()} - EXPENSE SUMMARY*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Total Trip Spend:* ${fmt(totalAmount)} (${nonSettlementExpenses.length} items)\n`;
    if (participants.length > 0) {
      msg += `👥 *Avg per Rider:* ${fmt(totalAmount / participants.length)}\n\n`;
    }

    if (categoryStats.length > 0) {
      msg += `📊 *Category Breakdown:*\n`;
      categoryStats.forEach(c => {
        msg += `${c.icon} ${c.label}: ${fmt(c.amount)} (${Math.round(c.percentage)}%)\n`;
      });
      msg += `\n`;
    }

    if (settlements.length > 0) {
      msg += `⚖️ *Pending Settle-Ups:*\n`;
      settlements.forEach(s => {
        msg += `• ${s.from.full_name} ➔ ${s.to.full_name}: *${fmt(s.amount)}*\n`;
      });
    } else {
      msg += `✅ *All accounts are settled up!*\n`;
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🛣️ _Tracked with Payanam Convoy_`;

    navigator.clipboard.writeText(msg).then(() => {
      showToast('📋 Copied WhatsApp summary to clipboard!');
    }).catch(() => {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    });
  };

  // CSV Export generator
  const exportCSV = () => {
    const headers = ['Date', 'Title', 'Category', 'Total Amount (INR)', 'Paid By', 'Split Type', 'Split Count', 'My Share (INR)', 'Status'];
    const rows = expenses.map(e => {
      const date = new Date(e.created_at).toLocaleDateString('en-IN');
      const catLabel = CATEGORY_MAP[e.category]?.label || e.category;
      const payer = getName(e.paid_by);
      const mySplit = e.expense_splits.find(s => s.user_id === currentUserId);
      const myShare = mySplit ? mySplit.amount.toString() : (e.paid_by === currentUserId ? 'Payer' : '0');
      const status = mySplit ? (mySplit.is_settled ? 'Settled' : 'Pending') : 'N/A';
      return [
        `"${date}"`,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${catLabel}"`,
        e.amount,
        `"${payer}"`,
        `"${e.split_type}"`,
        e.expense_splits.length,
        myShare,
        `"${status}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payanam-expenses-${tripId.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 Downloaded CSV report');
  };

  const customTotal = Object.values(form.custom_splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const customRemaining = parseFloat(form.amount || '0') - customTotal;

  // UPI deep link & QR target for settle modal
  const upiIntentUrl = useMemo(() => {
    if (!settleModal.to) return '';
    const cleanUpi = (settleModal.upiId || 'rider@upi').trim();
    const cleanName = encodeURIComponent(settleModal.to.full_name);
    const note = encodeURIComponent(`Payanam Split - ${tripTitle}`);
    return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${settleModal.amount.toFixed(2)}&cu=INR&tn=${note}`;
  }, [settleModal, tripTitle]);

  const upiQrImgUrl = useMemo(() => {
    if (!upiIntentUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(upiIntentUrl)}`;
  }, [upiIntentUrl]);

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⏳</div>
          <p style={{ margin: 0, fontWeight: 600 }}>Loading trip expenses & balances...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.startsWith('✅') ? '#065f46' : '#991b1b',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          zIndex: 10000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {toast}
        </div>
      )}

      {/* Top Banner & Action Header */}
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>💸</span>
            <h3 style={styles.headerTitle}>Trip Expenses & Split</h3>
          </div>
          <p style={styles.headerSubtitle}>
            Total Spend: <strong style={{ color: 'var(--text-primary)' }}>{fmt(totalAmount)}</strong>
            <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>•</span>
            <span>{nonSettlementExpenses.length} expense{nonSettlementExpenses.length !== 1 ? 's' : ''}</span>
            {participants.length > 0 && (
              <>
                <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>•</span>
                <span>Avg {fmt(totalAmount / participants.length)} / rider</span>
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={generateWhatsAppSummary}
            title="Share summary on WhatsApp"
            style={styles.btnSecondary}
          >
            <span>📱</span> WhatsApp
          </button>
          <button
            onClick={exportCSV}
            title="Download CSV spreadsheet"
            style={styles.btnSecondary}
          >
            <span>📥</span> CSV
          </button>
          <button
            onClick={openModal}
            style={styles.btnPrimary}
          >
            <span>+</span> Add Expense
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="responsive-tabs-bar" style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('expenses')}
          style={{
            ...styles.tabBtn,
            color: activeTab === 'expenses' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'expenses' ? '3px solid var(--accent-gold)' : '3px solid transparent',
            background: activeTab === 'expenses' ? 'var(--accent-gold-bg)' : 'transparent',
          }}
        >
          📋 Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            ...styles.tabBtn,
            color: activeTab === 'analytics' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'analytics' ? '3px solid var(--accent-gold)' : '3px solid transparent',
            background: activeTab === 'analytics' ? 'var(--accent-gold-bg)' : 'transparent',
          }}
        >
          📊 Analytics & Breakdown
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          style={{
            ...styles.tabBtn,
            color: activeTab === 'balances' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'balances' ? '3px solid var(--accent-gold)' : '3px solid transparent',
            background: activeTab === 'balances' ? 'var(--accent-gold-bg)' : 'transparent',
          }}
        >
          ⚖️ Balances & Settle Up {settlements.length > 0 && <span style={styles.pendingBadge}>{settlements.length}</span>}
        </button>
      </div>

      {/* TAB 1: EXPENSES LIST */}
      {activeTab === 'expenses' && (
        <div style={{ padding: '20px' }}>
          {/* Search & Category Filter Bar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by title or rider..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...styles.input, paddingLeft: 34 }}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ ...styles.input, width: 'auto', minWidth: 150 }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* List items */}
          {filteredExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛣️</div>
              <p style={{ margin: 0, fontWeight: 600, color: '#475569', fontSize: 16 }}>No expenses found</p>
              <p style={{ margin: '4px 0 16px', fontSize: 13 }}>
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or category filter.'
                  : 'Start tracking fuel, food, and stays for your road trip!'}
              </p>
              <button onClick={openModal} style={styles.btnPrimary}>
                + Add First Expense
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredExpenses.map(expense => {
                const cat = CATEGORY_MAP[expense.category] || CATEGORY_MAP.other;
                const myShare = expense.expense_splits.find(s => s.user_id === currentUserId);
                const isPayer = expense.paid_by === currentUserId;
                const isCreator = expense.added_by === currentUserId;
                const dateStr = new Date(expense.created_at).toLocaleDateString('en-IN', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                });

                return (
                  <div key={expense.id} style={styles.expenseCard}>
                    {/* Category Icon Badge */}
                    <div style={{ ...styles.categoryBadge, background: cat.bg, color: cat.color }}>
                      <span style={{ fontSize: 22 }}>{cat.icon}</span>
                    </div>

                    {/* Middle Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {expense.title}
                        </h4>
                        <span style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontWeight: 600,
                          background: cat.bg,
                          color: cat.color,
                        }}>
                          {cat.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {dateStr}</span>
                      </div>

                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>
                          Paid by <strong style={{ color: isPayer ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>{getName(expense.paid_by)}{isPayer ? ' (You)' : ''}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {expense.split_type === 'equal'
                            ? `Split equally (${expense.expense_splits.length} riders)`
                            : `Custom split (${expense.expense_splits.length} riders)`}
                        </span>
                      </div>

                      {/* Personal share pill */}
                      {myShare && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: myShare.is_settled ? 'var(--accent-green-bg)' : 'var(--accent-gold-bg)',
                            color: myShare.is_settled ? 'var(--accent-green)' : 'var(--accent-gold)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            Your share: {fmtDec(myShare.amount)} {myShare.is_settled ? '✅ Settled' : '⏳ Unsettled'}
                          </span>

                          <button
                            onClick={() => handleToggleSplitSettled(myShare.id)}
                            disabled={settlingSplitId === myShare.id}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-card)',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            {settlingSplitId === myShare.id ? 'Saving...' : myShare.is_settled ? 'Mark Unsettled' : 'Mark Settled'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Amount & Actions */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtDec(expense.amount)}
                      </div>
                      {isCreator && (
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          style={styles.btnDelete}
                        >
                          {deletingId === expense.id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANALYTICS & BREAKDOWN */}
      {activeTab === 'analytics' && (
        <div style={{ padding: '20px' }}>
          {/* Key Metrics 4-Grid */}
          <div className="responsive-metrics-grid" style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Spent</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{fmt(totalAmount)}</div>
              <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>{nonSettlementExpenses.length} total entries</span>
            </div>
            <div style={styles.metricCard}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Avg / Rider</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {participants.length > 0 ? fmt(totalAmount / participants.length) : '₹0'}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Across {participants.length} riders</span>
            </div>
            <div style={styles.metricCard}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Top Category</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {categoryStats[0] ? `${categoryStats[0].icon} ${categoryStats[0].label}` : 'None'}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {categoryStats[0] ? `${fmt(categoryStats[0].amount)} (${Math.round(categoryStats[0].percentage)}%)` : '-'}
              </span>
            </div>
            <div style={styles.metricCard}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Top Contributor</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {contributorStats[0] ? contributorStats[0].name : 'None'}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {contributorStats[0] ? fmt(contributorStats[0].amount) : '-'}
              </span>
            </div>
          </div>

          {/* Category Breakdown Progress Bars */}
          <div style={{ marginTop: 24, background: 'var(--bg-subtle)', borderRadius: 12, padding: 18, border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              📊 Spending by Category
            </h4>
            {categoryStats.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>No category data available yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {categoryStats.map(cat => (
                  <div key={cat.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cat.icon} {cat.label}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fmtDec(cat.amount)} <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>({cat.percentage.toFixed(1)}%)</span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ height: 8, background: 'var(--border-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                        background: cat.color,
                        borderRadius: 999,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rider Contributions Breakdown */}
          <div style={{ marginTop: 20, background: 'var(--bg-subtle)', borderRadius: 12, padding: 18, border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              👥 Paid Out of Pocket
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contributorStats.map(contributor => (
                <div key={contributor.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={styles.miniAvatar}>
                      {contributor.name[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {contributor.name}{contributor.userId === currentUserId ? ' (You)' : ''}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtDec(contributor.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BALANCES & SETTLE UP */}
      {activeTab === 'balances' && (
        <div style={{ padding: '20px' }}>
          {/* Net Balances List */}
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Individual Net Balances
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {participants.map(p => {
              const bal = balances[p.id] ?? 0;
              const isMe = p.id === currentUserId;
              const isPositive = bal > 0.01;
              const isNegative = bal < -0.01;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: isMe ? 'var(--accent-green-bg)' : 'var(--bg-subtle)',
                    border: `1px solid ${isMe ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isPositive ? '#10b981' : isNegative ? '#ef4444' : 'var(--text-secondary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                    }}>
                      {p.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {p.full_name}{isMe ? ' (You)' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.role === 'owner' ? '👑 Convoy Lead' : '🏍️ Rider'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: isPositive ? '#059669' : isNegative ? '#dc2626' : 'var(--text-secondary)',
                    }}>
                      {isPositive ? `+${fmtDec(bal)}` : fmtDec(bal)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isPositive ? '#059669' : isNegative ? '#dc2626' : 'var(--text-secondary)' }}>
                      {isPositive ? 'Gets back' : isNegative ? 'Owes group' : 'All settled'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settle Up Action Cards */}
          <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚡</span> Recommended Settle-Up Transactions
              </h4>
            </div>

            {settlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--accent-green-bg)', borderRadius: 12, border: '1px solid var(--accent-green)' }}>
                <span style={{ fontSize: 32 }}>🎉</span>
                <p style={{ margin: '8px 0 0', fontWeight: 700, color: 'var(--accent-green)', fontSize: 15 }}>All accounts are settled up!</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Nobody owes anyone anything in this convoy.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {settlements.map((txn, i) => {
                  const isDebtor = txn.from.id === currentUserId;
                  const isCreditor = txn.to.id === currentUserId;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '14px 18px',
                        background: 'var(--bg-subtle)',
                        borderRadius: 12,
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--card-shadow)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                        <span style={{ fontSize: 24 }}>💸</span>
                        <div>
                          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            <strong style={{ color: isDebtor ? '#ef4444' : 'var(--text-primary)' }}>
                              {isDebtor ? 'You' : txn.from.full_name}
                            </strong>
                            {' '}pays{' '}
                            <strong style={{ color: isCreditor ? '#10b981' : 'var(--text-primary)' }}>
                              {isCreditor ? 'You' : txn.to.full_name}
                            </strong>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-gold)', marginTop: 2 }}>
                            {fmtDec(txn.amount)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openSettleModal(txn.from, txn.to, txn.amount)}
                        style={styles.btnSettle}
                      >
                        <span>📲</span> Pay / Settle via UPI
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD EXPENSE MODAL */}
      {/* ======================================================== */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>➕</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Add Road Trip Expense</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={styles.modalClose}>✕</button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Quick Presets</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUICK_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={styles.label}>What for? (Description)</label>
                <input
                  type="text"
                  placeholder="e.g. Fuel refill at Shell, Dhaba Lunch, Fastag..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={styles.input}
                  autoFocus
                />
              </div>

              {/* Amount */}
              <div>
                <label style={styles.label}>Total Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-secondary)' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={{ ...styles.input, paddingLeft: 28, fontSize: 16, fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Category + Paid By Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={styles.label}>Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={styles.input}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Paid by</label>
                  <select
                    value={form.paid_by}
                    onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
                    style={styles.input}
                  >
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}{p.id === currentUserId ? ' (You)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split Type Toggle */}
              <div>
                <label style={styles.label}>Split Type</label>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {(['equal', 'custom'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, split_type: t }))}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        background: form.split_type === t ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                        color: form.split_type === t ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {t === 'equal' ? '👥 Split Equally' : '✏️ Custom Split'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equal Split Selection */}
              {form.split_type === 'equal' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={styles.label}>Split Among ({form.split_among.length} riders)</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        split_among: f.split_among.length === participants.length ? [] : participants.map(p => p.id),
                      }))}
                      style={{ fontSize: 11, color: 'var(--accent-gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {form.split_among.length === participants.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {participants.map(p => {
                      const checked = form.split_among.includes(p.id);
                      const perPerson = form.amount && form.split_among.length > 0
                        ? parseFloat(form.amount) / form.split_among.length
                        : 0;

                      return (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            background: checked ? 'var(--accent-green-bg)' : 'var(--bg-subtle)',
                            borderRadius: 8,
                            border: `1px solid ${checked ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                          }}
                        >
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
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {p.full_name}{p.id === currentUserId ? ' (You)' : ''}
                          </span>
                          {checked && perPerson > 0 && (
                            <span style={{ fontSize: 13, color: 'var(--accent-gold)', fontWeight: 700 }}>
                              {fmtDec(perPerson)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Split Amounts */}
              {form.split_type === 'custom' && (
                <div>
                  <label style={styles.label}>Custom Amount per Rider</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {participants.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-subtle)',
                          borderRadius: 8,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.full_name}{p.id === currentUserId ? ' (You)' : ''}
                        </span>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-secondary)' }}>₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.custom_splits[p.id] ?? ''}
                            onChange={e => setForm(f => ({
                              ...f,
                              custom_splits: { ...f.custom_splits, [p.id]: e.target.value },
                            }))}
                            placeholder="0"
                            style={{ ...styles.input, width: 100, padding: '6px 6px 6px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    ))}

                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      background: Math.abs(customRemaining) < 0.05 ? 'var(--accent-green-bg)' : 'var(--accent-gold-bg)',
                      border: `1px solid ${Math.abs(customRemaining) < 0.05 ? 'var(--accent-green)' : 'var(--accent-gold)'}`,
                      color: Math.abs(customRemaining) < 0.05 ? 'var(--accent-green)' : 'var(--accent-gold)',
                    }}>
                      {Math.abs(customRemaining) < 0.05
                        ? '✅ Total amounts match perfectly!'
                        : `${customRemaining > 0 ? `₹${customRemaining.toFixed(2)} left to allocate` : `₹${Math.abs(customRemaining).toFixed(2)} exceeds total`}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  ...styles.btnPrimary,
                  padding: '12px',
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 8,
                  opacity: saving ? 0.7 : 1,
                  justifyContent: 'center',
                }}
              >
                {saving ? 'Recording Expense...' : '+ Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* UPI SETTLE-UP MODAL */}
      {/* ======================================================== */}
      {settleModal.show && settleModal.from && settleModal.to && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: 440 }}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  UPI Instant Settle-Up
                </h3>
              </div>
              <button
                onClick={() => setSettleModal(prev => ({ ...prev, show: false }))}
                style={styles.modalClose}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>{settleModal.from.full_name}</strong> is paying
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
                {settleModal.to.full_name}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent-green)' }}>
                {fmtDec(settleModal.amount)}
              </div>
            </div>

            {/* UPI ID input */}
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Receiver's UPI ID / VPA</label>
              <input
                type="text"
                value={settleModal.upiId}
                onChange={e => setSettleModal(prev => ({ ...prev, upiId: e.target.value }))}
                placeholder="e.g. mobile@upi or name@okaxis"
                style={styles.input}
              />
            </div>

            {/* Live UPI QR Code */}
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
              marginBottom: 16,
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Scan with GPay, PhonePe, Paytm, or BHIM
              </p>
              <div style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <img
                  src={upiQrImgUrl}
                  alt="UPI QR Code"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
                Amount of {fmtDec(settleModal.amount)} is pre-filled
              </p>
            </div>

            {/* Mobile UPI Deep Link */}
            <a
              href={upiIntentUrl}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '12px',
                borderRadius: 8,
                background: '#059669',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 10,
              }}
            >
              📲 Open in GPay / PhonePe / Paytm
            </a>

            {/* Confirm & Record Settlement Button */}
            <button
              onClick={confirmSettlement}
              disabled={settleModal.isSettling}
              style={{
                ...styles.btnPrimary,
                width: '100%',
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                justifyContent: 'center',
              }}
            >
              {settleModal.isSettling ? 'Recording Settlement...' : '✅ Confirm & Mark as Settled'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    borderRadius: 16,
    border: '1px solid var(--border-card)',
    boxShadow: 'var(--card-shadow)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-card)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 18px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: 'var(--card-shadow)',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSettle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnDelete: {
    marginTop: 4,
    padding: '3px 8px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 4,
    color: '#ef4444',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid var(--border-card)',
    background: 'var(--bg-subtle)',
  },
  tabBtn: {
    flex: 1,
    minWidth: 120,
    whiteSpace: 'nowrap',
    padding: '14px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pendingBadge: {
    background: '#ea580c',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 800,
    padding: '1px 6px',
    borderRadius: 999,
  },
  expenseCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '14px 16px',
    background: 'var(--bg-subtle)',
    borderRadius: 12,
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--card-shadow)',
  },
  categoryBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  metricCard: {
    background: 'var(--bg-subtle)',
    borderRadius: 12,
    padding: '14px 16px',
    border: '1px solid var(--border-subtle)',
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--accent-cyan-bg)',
    color: 'var(--accent-cyan)',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modalContent: {
    background: 'var(--bg-card)',
    borderRadius: 16,
    border: '1px solid var(--border-card)',
    color: 'var(--text-primary)',
    padding: 'clamp(16px, 4vw, 24px)',
    width: 'min(480px, 94vw)',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--card-shadow)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    lineHeight: 1,
  },
};

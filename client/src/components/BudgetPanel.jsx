import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './ToastProvider.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, SectionHeading, Select, Spinner } from './ui.jsx';

const CATEGORIES = ['accommodation', 'food', 'activities', 'transport', 'other'];

const EMPTY = {
  description: '',
  category: 'other',
  estimatedAmount: '',
  actualAmount: '',
  paidBy: '',
  splitEvenly: true,
};

function money(value, currency = 'CAD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value) || 0);
}

/**
 * Budget tracker and summary dashboard.
 *
 * Phase 2 enhancements:
 *  - "Split evenly" one-click action (Stakeholder Meeting 2, Q2).
 *  - Totals recalculated and re-rendered immediately after every change, so the
 *    running total is never stale (Stakeholder Meeting 2, Q5).
 */
export default function BudgetPanel({ trip, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // item | 'new'
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/trips/${trip._id}/budget`));
    } catch (err) {
      toast.error(err.message);
    }
  }, [trip._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm({ ...EMPTY, paidBy: user.userId });
    setEditing('new');
    setError('');
  }

  function openEdit(item) {
    setForm({
      description: item.description,
      category: item.category,
      estimatedAmount: item.estimatedAmount || '',
      actualAmount: item.actualAmount || '',
      paidBy: item.paidBy?._id || item.paidBy || '',
      splitEvenly: item.splitEvenly,
    });
    setEditing(item);
    setError('');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      ...form,
      estimatedAmount: Number(form.estimatedAmount) || 0,
      actualAmount: Number(form.actualAmount) || 0,
    };
    try {
      // The API returns the recalculated summary with the item, so the totals
      // below update in the same render as the list.
      if (editing === 'new') await api.post(`/trips/${trip._id}/budget`, body);
      else await api.put(`/trips/${trip._id}/budget/${editing._id}`, body);

      // Phase 3 (Stakeholder Meeting 3): confirmations name what was saved.
      toast.success(editing === 'new' ? `Expense "${form.description}" added.` : `Expense "${form.description}" updated.`);
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Remove "${item.description}" from the budget?`)) return;
    try {
      await api.del(`/trips/${trip._id}/budget/${item._id}`);
      toast.success('Expense removed.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  /** Phase 2: the "Split evenly" button requested by the stakeholder. */
  async function splitEvenly(item) {
    try {
      const res = await api.post(`/trips/${trip._id}/budget/${item._id}/split-evenly`);
      toast.success(`Split evenly — ${money(res.perPerson, item.currency)} per person.`);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!data) return <Spinner label="Loading budget" />;

  const { items, summary, members } = data;
  const maxCategory = Math.max(1, ...Object.values(summary.categoryTotals));
  const nameOf = (id) => members.find((m) => m.userId === String(id))?.displayName || 'Unknown';

  return (
    <div className="space-y-4">
      {/* Summary dashboard */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-slate-600">Estimated total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(summary.totalEstimated)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-600">Actually spent</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(summary.totalActual)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-600">Remaining vs estimate</p>
          <p className={`mt-1 text-2xl font-bold ${summary.remaining < 0 ? 'text-red-700' : 'text-green-800'}`}>
            {money(summary.remaining)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="By category" subtitle="Uses the actual amount once recorded, otherwise the estimate." />
          <ul className="space-y-3">
            {CATEGORIES.map((category) => {
              const value = summary.categoryTotals[category] || 0;
              return (
                <li key={category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold capitalize text-slate-800">{category}</span>
                    <span className="font-mono text-slate-700">{money(value)}</span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-700"
                      style={{ width: `${Math.round((value / maxCategory) * 100)}%` }}
                      role="img"
                      aria-label={`${category}: ${money(value)}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionHeading title="Per member" subtitle="What each person owes, has paid, and their balance." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Per-member budget balances</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th scope="col" className="py-2 pr-2 font-semibold">Member</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">Owes</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">Paid</th>
                  <th scope="col" className="py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summary.perMember.map((row) => (
                  <tr key={row.userId} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold text-slate-800">{nameOf(row.userId)}</th>
                    <td className="py-2 pr-2 text-right font-mono">{money(row.owed)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{money(row.paid)}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${row.balance < 0 ? 'text-red-700' : 'text-green-800'}`}>
                      {money(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            A negative balance means that member still owes the group; a positive balance means they are owed money back.
          </p>
        </Card>
      </div>

      {/* Ledger */}
      <Card>
        <SectionHeading
          title="Expenses"
          subtitle={`${summary.itemCount} item${summary.itemCount === 1 ? '' : 's'} in the shared ledger`}
          action={<Button onClick={openNew}>+ Add expense</Button>}
        />

        {items.length === 0 ? (
          <EmptyState title="No expenses yet" message="Add estimated costs first, then fill in the actual amounts as you spend." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item._id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                <div className="mr-auto min-w-0">
                  <p className="font-semibold text-slate-900">{item.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Badge tone="blue">{item.category}</Badge>
                    {item.splitEvenly ? <Badge tone="green">Split evenly</Badge> : <Badge tone="slate">Custom split</Badge>}
                    <Badge tone="slate">Paid by {item.paidBy?.displayName || item.paidBy?.username || '—'}</Badge>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-semibold text-slate-900">{money(item.actualAmount || item.estimatedAmount, item.currency)}</p>
                  <p className="text-xs text-slate-600">
                    {item.actualAmount > 0 ? 'actual' : 'estimated'}
                    {members.length > 0 && ` · ${money((item.actualAmount || item.estimatedAmount) / Math.max(1, item.splitEvenly ? members.length : (item.splitBetween?.length || 1)), item.currency)} pp`}
                  </p>
                </div>

                <div className="flex gap-1">
                  {!item.splitEvenly && (
                    <Button variant="ghost" onClick={() => splitEvenly(item)}>
                      Split evenly
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => remove(item)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Add expense' : 'Edit expense'} onClose={() => setEditing(null)}>
        <form className="space-y-4" onSubmit={save} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="Description" required>
            {(props) => (
              <Input {...props} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {(props) => (
                <Select {...props} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Paid by">
              {(props) => (
                <Select {...props} value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Estimated amount" hint="What you expect it to cost.">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.estimatedAmount}
                  onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })}
                />
              )}
            </Field>

            <Field label="Actual amount" hint="Leave at 0 until it is paid.">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.actualAmount}
                  onChange={(e) => setForm({ ...form, actualAmount: e.target.value })}
                />
              )}
            </Field>
          </div>

          <label className="flex min-h-touch items-center gap-3 rounded-lg border border-slate-300 px-3 py-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-400"
              checked={form.splitEvenly}
              onChange={(e) => setForm({ ...form, splitEvenly: e.target.checked })}
            />
            <span className="text-sm font-semibold text-slate-800">
              Split evenly between all {members.length} joined member{members.length === 1 ? '' : 's'}
              {form.splitEvenly && Number(form.actualAmount || form.estimatedAmount) > 0 && (
                <span className="ml-1 font-normal text-slate-600">
                  ({money(Number(form.actualAmount || form.estimatedAmount) / Math.max(1, members.length))} each)
                </span>
              )}
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.description.trim()}>
              {busy ? 'Saving…' : 'Save expense'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

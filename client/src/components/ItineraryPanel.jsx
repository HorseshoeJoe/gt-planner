import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './ToastProvider.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, SectionHeading, Select, Spinner, Textarea } from './ui.jsx';

const CATEGORIES = [
  { value: 'sightseeing', label: 'Sightseeing', tone: 'blue' },
  { value: 'food', label: 'Food', tone: 'amber' },
  { value: 'rest', label: 'Rest', tone: 'slate' },
  { value: 'transit', label: 'Transit', tone: 'green' },
  { value: 'other', label: 'Other', tone: 'slate' },
];

const EMPTY = { title: '', startTime: '09:00', endTime: '10:00', category: 'sightseeing', notes: '' };

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Client-side mirror of the server's overlap rule, for instant feedback. */
function toMinutes(hhmm) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function localConflicts(candidate, activities, ignoreId) {
  const start = toMinutes(candidate.startTime);
  if (start === null) return [];
  const end = toMinutes(candidate.endTime) ?? start;

  return activities.filter((a) => {
    if (ignoreId && String(a._id) === String(ignoreId)) return false;
    const aStart = toMinutes(a.startTime);
    if (aStart === null) return false;
    const aEnd = toMinutes(a.endTime) ?? aStart;
    if (end === start && aEnd === aStart) return start === aStart;
    return start < aEnd && aStart < end;
  });
}

export default function ItineraryPanel({ trip, onChanged }) {
  const toast = useToast();
  const [days, setDays] = useState(null);
  const [activeDate, setActiveDate] = useState(null);
  const [editing, setEditing] = useState(null); // { date, activity | null }
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/trips/${trip._id}/itinerary`);
      setDays(data);
      setActiveDate((current) => current || data[0]?.date || null);
    } catch (err) {
      toast.error(err.message);
    }
  }, [trip._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const day = useMemo(() => days?.find((d) => d.date === activeDate) || null, [days, activeDate]);

  // Phase 2: live overlap warning while the user is still typing.
  const pendingConflicts = useMemo(() => {
    if (!editing || !day) return [];
    return localConflicts(form, day.activities, editing.activity?._id);
  }, [editing, day, form]);

  function openNew(date) {
    setEditing({ date, activity: null });
    setForm(EMPTY);
    setError('');
  }

  function openEdit(date, activity) {
    setEditing({ date, activity });
    setForm({
      title: activity.title,
      startTime: activity.startTime,
      endTime: activity.endTime || '',
      category: activity.category,
      notes: activity.notes || '',
    });
    setError('');
  }

  async function save(e, force = false) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    const { date, activity } = editing;
    const body = { ...form, force };

    try {
      if (activity) {
        await api.put(`/trips/${trip._id}/itinerary/${date}/activities/${activity._id}`, body);
      } else {
        await api.post(`/trips/${trip._id}/itinerary/${date}/activities`, body);
      }
      // Phase 3 (Stakeholder Meeting 3): confirmations name what was saved.
      toast.success(activity ? `Activity "${form.title}" updated.` : `Activity "${form.title}" added.`);
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      if (err.status === 409) {
        const list = (err.payload?.conflicts || []).map((c) => `${c.startTime}–${c.endTime || '…'} ${c.title}`).join(', ');
        setError(`${err.message} Clashes with: ${list}. Choose a different time, or save anyway if the group is splitting up.`);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(date, activity) {
    if (!window.confirm(`Remove "${activity.title}" from the itinerary?`)) return;
    try {
      await api.del(`/trips/${trip._id}/itinerary/${date}/activities/${activity._id}`);
      toast.success('Activity removed.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function saveNotes(date, notes) {
    try {
      await api.put(`/trips/${trip._id}/itinerary/${date}/notes`, { notes });
      toast.success('Day notes saved.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!days) return <Spinner label="Loading itinerary" />;

  return (
    <div className="space-y-4">
      {/* Day selector - horizontally scrollable so it stays usable on a phone. */}
      <div role="tablist" aria-label="Trip days" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d) => {
          const selected = d.date === activeDate;
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveDate(d.date)}
              className={`min-h-touch shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold ${
                selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {longDate(d.date)}
              <span className={`ml-2 rounded-full px-1.5 text-xs ${selected ? 'bg-white/25' : 'bg-slate-100'}`}>
                {d.activities.length}
              </span>
            </button>
          );
        })}
      </div>

      {day && (
        <Card>
          <SectionHeading
            title={longDate(day.date)}
            subtitle={`${day.activities.length} activit${day.activities.length === 1 ? 'y' : 'ies'} scheduled`}
            action={<Button onClick={() => openNew(day.date)}>+ Add activity</Button>}
          />

          {day.activities.length === 0 ? (
            <EmptyState title="Nothing planned for this day yet" message="Add the first activity to start building the schedule." />
          ) : (
            <ol className="space-y-3">
              {day.activities.map((activity) => {
                const category = CATEGORIES.find((c) => c.value === activity.category) || CATEGORIES[4];
                const clashes = localConflicts(activity, day.activities, activity._id);
                return (
                  <li key={activity._id} className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3 sm:flex-nowrap">
                    <div className="w-24 shrink-0 font-mono text-sm font-semibold text-slate-800">
                      {activity.startTime}
                      {activity.endTime && <span className="block text-slate-500">{activity.endTime}</span>}
                    </div>

                    <div className="mr-auto min-w-0">
                      <p className="font-semibold text-slate-900">{activity.title}</p>
                      {activity.notes && <p className="mt-0.5 text-sm text-slate-600">{activity.notes}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <Badge tone={category.tone}>{category.label}</Badge>
                        {clashes.length > 0 && <Badge tone="red">⚠ Overlaps {clashes.length} item{clashes.length > 1 ? 's' : ''}</Badge>}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => openEdit(day.date, activity)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => remove(day.date, activity)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <DayNotes key={day.date} initial={day.notes} onSave={(notes) => saveNotes(day.date, notes)} />
        </Card>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.activity ? 'Edit activity' : 'Add activity'}
        onClose={() => setEditing(null)}
      >
        <form className="space-y-4" onSubmit={(e) => save(e, false)} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="What are you doing?" required>
            {(props) => <Input {...props} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start time" required>
              {(props) => (
                <Input {...props} type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
              )}
            </Field>
            <Field label="End time" hint="Optional.">
              {(props) => <Input {...props} type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />}
            </Field>
          </div>

          {/* Phase 2: warn about scheduling conflicts before the form is submitted. */}
          {pendingConflicts.length > 0 && (
            <p role="status" className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              ⚠ This time overlaps with:{' '}
              {pendingConflicts.map((c) => `${c.startTime}–${c.endTime || '…'} ${c.title}`).join(', ')}
            </p>
          )}

          <Field label="Category">
            {(props) => (
              <Select {...props} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Notes" hint="Optional — meeting point, booking reference, anything useful.">
            {(props) => <Textarea {...props} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            {error.includes('Clashes with') && (
              <Button variant="danger" onClick={(e) => save(e, true)} disabled={busy}>
                Save anyway
              </Button>
            )}
            <Button type="submit" disabled={busy || !form.title.trim()}>
              {busy ? 'Saving…' : 'Save activity'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function DayNotes({ initial, onSave }) {
  const [notes, setNotes] = useState(initial || '');
  const dirty = notes !== (initial || '');

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <Field label="Notes for this day" hint="Shared with everyone on the trip.">
        {(props) => <Textarea {...props} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <Button variant="secondary" className="mt-2" onClick={() => onSave(notes)} disabled={!dirty}>
        Save notes
      </Button>
    </div>
  );
}

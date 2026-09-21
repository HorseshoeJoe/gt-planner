import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from './ToastProvider.jsx';
import { Button, Card, EmptyState, ErrorNote, Field, Input, Modal, SectionHeading, Select, Spinner, Textarea } from './ui.jsx';

/**
 * Shared CRUD panel for the attractions, restaurants and transportation
 * sections. Each section supplies a field schema and a row renderer; the list,
 * modal form, validation and delete confirmation are handled here so all three
 * behave identically (a usability point raised in Stakeholder Meeting 2).
 */
export default function CollectionPanel({
  trip,
  resource,     // API path segment, e.g. 'attractions'
  title,
  subtitle,
  addLabel,
  emptyTitle,
  emptyMessage,
  fields,       // [{ name, label, type, options, hint, required, full }]
  renderItem,   // (item) => JSX
  onChanged,
  // Phase 3 (Stakeholder Meeting 3): confirmations should say clearly WHAT was
  // saved or removed, not just "Added." / "Removed.".
  noun = 'Entry',            // e.g. 'Attraction', 'Restaurant'
  itemLabel = (i) => i.name, // how to name one item in messages
}) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // item | 'new'
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const blank = useCallback(
    () => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])),
    [fields]
  );

  const load = useCallback(async () => {
    try {
      setItems(await api.get(`/trips/${trip._id}/${resource}`));
    } catch (err) {
      toast.error(err.message);
    }
  }, [trip._id, resource, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm(blank());
    setEditing('new');
    setError('');
  }

  function openEdit(item) {
    const next = {};
    fields.forEach((f) => {
      const value = item[f.name];
      if (value === undefined || value === null) next[f.name] = '';
      // Datetime values are stored exactly as the input produced them
      // ("YYYY-MM-DDTHH:MM"), so they are passed straight back without a
      // timezone conversion that would shift the displayed time.
      else if (f.type === 'datetime-local') next[f.name] = String(value).slice(0, 16);
      else next[f.name] = value;
    });
    setForm(next);
    setEditing(item);
    setError('');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editing === 'new') await api.post(`/trips/${trip._id}/${resource}`, form);
      else await api.put(`/trips/${trip._id}/${resource}/${editing._id}`, form);

      const savedName = itemLabel(form) || noun.toLowerCase();
      toast.success(
        editing === 'new' ? `${noun} "${savedName}" added.` : `${noun} "${savedName}" updated.`
      );
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
    const label = itemLabel(item);
    if (!window.confirm(`Remove ${label ? `"${label}"` : 'this entry'}? This cannot be undone.`)) return;
    try {
      await api.del(`/trips/${trip._id}/${resource}/${item._id}`);
      toast.success(`${noun} ${label ? `"${label}"` : ''} removed.`.replace('  ', ' '));
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!items) return <Spinner label={`Loading ${title.toLowerCase()}`} />;

  return (
    <Card>
      <SectionHeading title={title} subtitle={subtitle} action={<Button onClick={openNew}>+ {addLabel}</Button>} />

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} action={<Button onClick={openNew}>+ {addLabel}</Button>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item._id} className="flex flex-col rounded-lg border border-slate-200 p-3">
              <div className="mr-auto min-w-0 grow">{renderItem(item)}</div>
              <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2">
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

      <Modal open={Boolean(editing)} title={editing === 'new' ? addLabel : `Edit ${title.toLowerCase().replace(/s$/, '')}`} onClose={() => setEditing(null)}>
        <form className="space-y-4" onSubmit={save} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={field.full ? 'sm:col-span-2' : ''}>
                <Field label={field.label} hint={field.hint} required={field.required}>
                  {(props) => {
                    const value = form[field.name] ?? '';
                    const onChange = (e) => setForm({ ...form, [field.name]: e.target.value });

                    if (field.type === 'textarea') return <Textarea {...props} value={value} onChange={onChange} />;
                    if (field.type === 'select') {
                      return (
                        <Select {...props} value={value} onChange={onChange} required={field.required}>
                          {field.allowEmpty && <option value="">— none —</option>}
                          {field.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      );
                    }
                    return (
                      <Input
                        {...props}
                        type={field.type || 'text'}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={value}
                        onChange={onChange}
                        required={field.required}
                      />
                    );
                  }}
                </Field>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

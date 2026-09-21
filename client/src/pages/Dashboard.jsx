import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../components/ToastProvider.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, Spinner, Textarea } from '../components/ui.jsx';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_TRIP = { title: '', destination: '', startDate: '', endDate: '', description: '' };

export default function Dashboard() {
  const toast = useToast();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TRIP);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrips(await api.get('/trips'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTrip(e) {
    e.preventDefault();
    setError('');
    if (form.endDate < form.startDate) {
      setError('End date cannot be before the start date.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/trips', form);
      setOpen(false);
      setForm(EMPTY_TRIP);
      toast.success('Trip created.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading your trips" />;

  const joined = trips.filter((t) => t.myStatus === 'joined');
  const invitations = trips.filter((t) => t.myStatus === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My trips</h1>
          <p className="text-sm text-slate-600">Everything you are planning, in one place.</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ New trip</Button>
      </div>

      {invitations.length > 0 && (
        <section aria-labelledby="invites-heading" className="space-y-3">
          <h2 id="invites-heading" className="text-base font-bold text-slate-900">
            Pending invitations
          </h2>
          {invitations.map((trip) => (
            <Card key={trip._id} className="border-amber-300 bg-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{trip.title}</p>
                  <p className="text-sm text-slate-700">
                    {trip.destination} · {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                  </p>
                </div>
                <Link to="/join">
                  <Button variant="secondary">Accept with invite code</Button>
                </Link>
              </div>
            </Card>
          ))}
        </section>
      )}

      {joined.length === 0 ? (
        <EmptyState
          title="No trips yet"
          message="Create a trip to start building an itinerary, or join one with an invite code a friend shared with you."
          action={<Button onClick={() => setOpen(true)}>Create your first trip</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {joined.map((trip) => (
            <li key={trip._id}>
              <Card className="flex h-full flex-col">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">{trip.title}</h2>
                  {trip.myRole === 'admin' && <Badge tone="blue">Creator</Badge>}
                </div>
                <p className="text-sm text-slate-700">{trip.destination}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="green">{trip.memberCounts.joined} joined</Badge>
                  {trip.memberCounts.pending > 0 && <Badge tone="amber">{trip.memberCounts.pending} pending</Badge>}
                </div>
                <div className="mt-4 flex gap-2 pt-2">
                  <Link to={`/trips/${trip._id}`} className="flex-1">
                    <Button className="w-full">Open</Button>
                  </Link>
                  <Link to={`/trips/${trip._id}/full-itinerary`}>
                    <Button variant="secondary">Summary</Button>
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} title="Create a new trip" onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={createTrip} noValidate>
          <ErrorNote>{error}</ErrorNote>

          <Field label="Trip name" required>
            {(props) => (
              <Input {...props} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            )}
          </Field>

          <Field label="Destination" required>
            {(props) => (
              <Input
                {...props}
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                required
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              )}
            </Field>
            <Field label="End date" required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              )}
            </Field>
          </div>

          <Field label="Description" hint="Optional — anything the group should know up front.">
            {(props) => (
              <Textarea {...props} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create trip'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

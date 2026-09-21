import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import usePolling from '../hooks/usePolling.js';
import LastUpdated from '../components/LastUpdated.jsx';
import MembersPanel from '../components/MembersPanel.jsx';
import ItineraryPanel from '../components/ItineraryPanel.jsx';
import AttractionsPanel from '../components/AttractionsPanel.jsx';
import RestaurantsPanel from '../components/RestaurantsPanel.jsx';
import TransportationPanel from '../components/TransportationPanel.jsx';
import BudgetPanel from '../components/BudgetPanel.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, Spinner, Textarea } from '../components/ui.jsx';

const TABS = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'attractions', label: 'Attractions' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'transport', label: 'Transport' },
  { id: 'budget', label: 'Budget' },
  { id: 'members', label: 'Members' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripWorkspace() {
  const { tripId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [trip, setTrip] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const tab = params.get('tab') || 'itinerary';

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      try {
        setTrip(await api.get(`/trips/${tripId}`));
      } catch (err) {
        toast.error(err.message);
        if (err.status === 403 || err.status === 404) navigate('/');
      } finally {
        setRefreshing(false);
      }
    },
    [tripId, toast, navigate]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Phase 2: keep the header's "last updated" line current without a manual refresh.
  usePolling(() => load(), 20000, Boolean(trip));

  async function saveTrip(e) {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/trips/${tripId}`, form);
      setEditOpen(false);
      toast.success('Trip details updated.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTrip() {
    if (!window.confirm(`Delete "${trip.title}" and everything in it? This cannot be undone.`)) return;
    try {
      await api.del(`/trips/${tripId}`);
      toast.success('Trip deleted.');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!trip) return <Spinner label="Loading trip" />;

  const joined = trip.members.filter((m) => m.status === 'joined').length;
  const pending = trip.members.filter((m) => m.status === 'pending').length;
  const panelProps = { trip, onChanged: () => load() };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to="/" className="text-sm font-semibold text-brand-700 underline">
              ← All trips
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{trip.title}</h1>
            <p className="text-sm text-slate-700">
              {trip.destination} · {formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {trip.days.length} days
            </p>
            {trip.description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{trip.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="green">{joined} joined</Badge>
              {pending > 0 && <Badge tone="amber">{pending} invite{pending > 1 ? 's' : ''} pending</Badge>}
              {trip.myRole === 'admin' && <Badge tone="blue">You are the trip creator</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/trips/${tripId}/full-itinerary`}>
              <Button variant="secondary">View full itinerary</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setForm({
                  title: trip.title,
                  destination: trip.destination,
                  startDate: String(trip.startDate).slice(0, 10),
                  endDate: String(trip.endDate).slice(0, 10),
                  description: trip.description || '',
                });
                setEditOpen(true);
              }}
            >
              Edit details
            </Button>
            {trip.myRole === 'admin' && (
              <Button variant="danger" onClick={deleteTrip}>
                Delete trip
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <LastUpdated
            at={trip.lastActivityAt}
            by={trip.lastActivityBy}
            label={trip.lastActivityLabel}
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        </div>
      </Card>

      <div role="tablist" aria-label="Trip sections" className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setParams({ tab: t.id })}
              className={`min-h-touch shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold ${
                selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === 'itinerary' && <ItineraryPanel {...panelProps} />}
        {tab === 'attractions' && <AttractionsPanel {...panelProps} />}
        {tab === 'restaurants' && <RestaurantsPanel {...panelProps} />}
        {tab === 'transport' && <TransportationPanel {...panelProps} />}
        {tab === 'budget' && <BudgetPanel {...panelProps} />}
        {tab === 'members' && <MembersPanel {...panelProps} />}
      </div>

      <Modal open={editOpen} title="Edit trip details" onClose={() => setEditOpen(false)}>
        {form && (
          <form className="space-y-4" onSubmit={saveTrip} noValidate>
            <ErrorNote>{error}</ErrorNote>

            <Field label="Trip name" required>
              {(props) => <Input {...props} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />}
            </Field>
            <Field label="Destination" required>
              {(props) => (
                <Input {...props} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" required>
                {(props) => (
                  <Input {...props} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                )}
              </Field>
              <Field label="End date" required>
                {(props) => (
                  <Input {...props} type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                )}
              </Field>
            </div>
            <Field label="Description">
              {(props) => <Textarea {...props} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

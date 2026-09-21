import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import LastUpdated from '../components/LastUpdated.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { Badge, Button, Card, Spinner } from '../components/ui.jsx';

function money(value, currency = 'CAD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value) || 0);
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Read-only chronological summary of the whole trip.
 * UML use case: "View Full Itinerary" «include» "Retrieve Trip Data".
 * Phase 2 addition: a print stylesheet so the group can take a paper copy.
 */
export default function FullItinerary() {
  const { tripId } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/trips/${tripId}/full-itinerary`));
    } catch (err) {
      toast.error(err.message);
    }
  }, [tripId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <Spinner label="Building your itinerary" />;

  const { trip, days, unscheduled, budget } = data;
  const scheduled = days.filter((d) => d.activities.length || d.attractions.length || d.transportation.length || d.notes);

  return (
    <div className="space-y-5">
      <style>{`@media print {
        header, footer, .no-print { display: none !important; }
        body { background: #fff; }
        main { max-width: none; padding: 0; }
      }`}</style>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to={`/trips/${tripId}`} className="no-print text-sm font-semibold text-brand-700 underline">
              ← Back to workspace
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{trip.title}</h1>
            <p className="text-sm text-slate-700">
              {trip.destination} · {new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}
            </p>
            {trip.description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{trip.description}</p>}
          </div>
          <Button variant="secondary" className="no-print" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-3">
          <LastUpdated at={trip.lastActivityAt} label={trip.lastActivityLabel} />
        </div>
      </Card>

      {scheduled.length === 0 ? (
        <Card>
          <p className="text-slate-700">Nothing has been scheduled yet. Add activities in the workspace and they will appear here.</p>
        </Card>
      ) : (
        scheduled.map((day) => (
          <Card key={day.date}>
            <h2 className="text-lg font-bold text-slate-900">{longDate(day.date)}</h2>
            {day.notes && <p className="mt-1 text-sm italic text-slate-600">{day.notes}</p>}

            {day.activities.length > 0 && (
              <ol className="mt-3 space-y-2">
                {day.activities.map((a) => (
                  <li key={a._id} className="flex gap-3 border-l-4 border-brand-100 pl-3">
                    <span className="w-24 shrink-0 font-mono text-sm font-semibold text-slate-800">
                      {a.startTime}
                      {a.endTime ? `–${a.endTime}` : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">{a.title}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">{a.category}</span>
                      {a.notes && <p className="text-sm text-slate-600">{a.notes}</p>}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {day.transportation.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Transport</h3>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {day.transportation.map((t) => (
                    <li key={t._id}>
                      {t.type} — {t.provider || '—'} {t.fromLocation ? `(${t.fromLocation} → ${t.toLocation || '?'})` : ''}
                      {t.bookingReference ? ` · Ref ${t.bookingReference}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {day.attractions.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Attractions</h3>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {day.attractions.map((a) => (
                    <li key={a._id}>
                      {a.name}
                      {a.rating ? ` · ${'★'.repeat(a.rating)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Restaurant shortlist</h2>
          {unscheduled.restaurants.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No restaurants saved.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {unscheduled.restaurants.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{r.name}</span>
                  {r.cuisine && <Badge tone="blue">{r.cuisine}</Badge>}
                  <Badge tone="green">{r.priceRange}</Badge>
                  {r.address && <span className="text-slate-600">{r.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900">Budget summary</h2>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-slate-600">Estimated</dt>
              <dd className="font-mono font-bold text-slate-900">{money(budget.totalEstimated)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Spent</dt>
              <dd className="font-mono font-bold text-slate-900">{money(budget.totalActual)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Remaining</dt>
              <dd className={`font-mono font-bold ${budget.remaining < 0 ? 'text-red-700' : 'text-green-800'}`}>
                {money(budget.remaining)}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(budget.categoryTotals).map(([category, value]) => (
              <li key={category} className="flex justify-between border-b border-slate-100 py-1 last:border-0">
                <span className="capitalize text-slate-700">{category}</span>
                <span className="font-mono text-slate-800">{money(value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {(unscheduled.attractions.length > 0 || unscheduled.transportation.length > 0) && (
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Not yet scheduled</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {unscheduled.attractions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Attractions</h3>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {unscheduled.attractions.map((a) => (
                    <li key={a._id}>{a.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {unscheduled.transportation.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Transport</h3>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {unscheduled.transportation.map((t) => (
                    <li key={t._id}>
                      {t.type} — {t.provider || t.notes || '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

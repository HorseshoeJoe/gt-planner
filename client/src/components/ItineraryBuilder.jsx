import { useEffect, useState } from 'react';
import ActivityForm from './ActivityForm';
import { getItinerary, deleteActivity } from '../api/itinerary';

export default function ItineraryBuilder({ tripId }) {
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // { date, activity }

    async function load() {
        setLoading(true);
        const res = await getItinerary(tripId);
        setDays(res.data || []);
        setLoading(false);
    }

    useEffect(() => { load(); }, [tripId]);

    async function remove(date, activityId) {
        if (!confirm('Delete this activity?')) return;
        await deleteActivity(tripId, date, activityId);
        load();
    }

    if (loading) return <p className="text-sm text-gray-500">Loading itinerary…</p>;

    return (
        <section className="space-y-6">
            <h2 className="text-xl font-semibold">Itinerary</h2>

            {days.map((day) => (
                <div key={day.date} className="rounded-lg border p-3">
                    <h3 className="mb-2 font-medium">{day.date}</h3>

                    {day.activities.length === 0 ? (
                        <p className="text-sm text-gray-500">No activities yet.</p>
                    ) : (
                        <ul className="space-y-1">
                            {day.activities.map((a) => (
                                <li key={a._id}
                                    className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-50">
                  <span>
                    <span className="font-mono text-sm">
                      {a.startTime}{a.endTime ? `–${a.endTime}` : ''}
                    </span>{' '}
                      <span>{a.title}</span>{' '}
                      <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{a.category}</span>
                  </span>
                                    <span className="flex gap-2 text-sm">
                    <button className="text-blue-600 hover:underline"
                            onClick={() => setEditing({ date: day.date, activity: a })}>Edit</button>
                    <button className="text-red-600 hover:underline"
                            onClick={() => remove(day.date, a._id)}>Delete</button>
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-3">
                        {(!editing || editing.date !== day.date) ? (
                            <button className="text-sm text-blue-600 hover:underline"
                                    onClick={() => setEditing({ date: day.date, activity: null })}>
                                + Add activity
                            </button>
                        ) : (
                            <ActivityForm
                                tripId={tripId}
                                date={day.date}
                                activities={day.activities}
                                editing={editing.activity}
                                onSaved={() => { setEditing(null); load(); }}
                                onCancel={() => setEditing(null)}
                            />
                        )}
                    </div>
                </div>
            ))}
        </section>
    );
}
import { useState } from 'react';
import { useItineraryConflicts } from '../hooks/useItineraryConflicts';
import ConflictBanner from './ConflictBanner';
import { addActivity, editActivity } from '../api/itinerary';

const CATEGORIES = ['sightseeing', 'food', 'rest', 'transit'];

export default function ActivityForm({ tripId, date, activities, editing, onSaved, onCancel }) {
    const [draft, setDraft] = useState(
        editing
            ? { title: editing.title, startTime: editing.startTime, endTime: editing.endTime || '',
                category: editing.category, notes: editing.notes || '' }
            : { title: '', startTime: '', endTime: '', category: 'sightseeing', notes: '' }
    );
    const [serverConflicts, setServerConflicts] = useState([]);
    const [error, setError] = useState('');

    const liveConflicts = useItineraryConflicts(draft, activities, editing?._id);

    const update = (field, value) => {
        setDraft((d) => ({ ...d, [field]: value }));
        setServerConflicts([]);
        setError('');
    };

    async function save(force = false) {
        setError('');
        const payload = { ...draft, force };
        const res = editing
            ? await editActivity(tripId, date, editing._id, payload)
            : await addActivity(tripId, date, payload);

        if (res.status === 409) {
            setServerConflicts(res.data.conflicts || []);
            return;
        }
        if (!res.ok) {
            setError(res.data.message || 'Save failed.');
            return;
        }
        onSaved(res.data);
    }

    const conflicts = serverConflicts.length ? serverConflicts : liveConflicts;

    return (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(false); }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-3">
                    <span className="text-sm font-medium">Title</span>
                    <input type="text" required value={draft.title}
                           onChange={(e) => update('title', e.target.value)}
                           className="mt-1 w-full rounded border px-2 py-1.5" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium">Start</span>
                    <input type="time" required value={draft.startTime}
                           onChange={(e) => update('startTime', e.target.value)}
                           className="mt-1 w-full rounded border px-2 py-1.5" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium">End (optional)</span>
                    <input type="time" value={draft.endTime}
                           onChange={(e) => update('endTime', e.target.value)}
                           className="mt-1 w-full rounded border px-2 py-1.5" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium">Category</span>
                    <select value={draft.category} onChange={(e) => update('category', e.target.value)}
                            className="mt-1 w-full rounded border px-2 py-1.5">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </label>
            </div>

            <label className="block">
                <span className="text-sm font-medium">Notes</span>
                <textarea value={draft.notes} rows={2}
                          onChange={(e) => update('notes', e.target.value)}
                          className="mt-1 w-full rounded border px-2 py-1.5" />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <ConflictBanner
                conflicts={conflicts}
                onSaveAnyway={() => save(true)}
                onCancel={() => { setServerConflicts([]); onCancel?.(); }}
            />

            <div className="flex gap-2">
                <button type="submit"
                        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {editing ? 'Update activity' : 'Add activity'}
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel}
                            className="rounded border px-4 py-2 hover:bg-gray-50">Cancel</button>
                )}
            </div>
        </form>
    );
}
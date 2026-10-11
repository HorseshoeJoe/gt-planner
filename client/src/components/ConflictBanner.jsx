export default function ConflictBanner({ conflicts, onSaveAnyway, onCancel }) {
    if (!conflicts?.length) return null;
    return (
        <div role="alert" aria-live="assertive"
             className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">
                This overlaps with {conflicts.length} other activit
                {conflicts.length === 1 ? 'y' : 'ies'}:
            </p>
            <ul className="mt-1 list-disc pl-5">
                {conflicts.map((c) => (
                    <li key={c._id}>
                        {c.startTime}{c.endTime ? `–${c.endTime}` : ''} · {c.title}
                    </li>
                ))}
            </ul>
            <div className="mt-3 flex gap-2">
                <button type="button" onClick={onSaveAnyway}
                        className="rounded bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
                    Save anyway
                </button>
                <button type="button" onClick={onCancel}
                        className="rounded border border-red-300 px-3 py-1.5 hover:bg-red-100">
                    Keep editing
                </button>
            </div>
        </div>
    );
}